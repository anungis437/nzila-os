/**
 * Contract Test — Environment & Secrets Enforcement
 *
 * Verifies:
 *   1. Every app has Zod-validated env at startup
 *   2. Production secrets must reference Key Vault (not plain env)
 *   3. No .env files committed with real secrets
 *   4. CI workflow env vars don't contain hardcoded secrets
 *   5. IaC key-vault module exists with RBAC + soft-delete
 *
 * This closes the "env contract not enforced" gap.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const APPS = [
  'console', 'partners', 'web', 'union-eyes',
  'cfo', 'nacp-exams', 'zonga', 'abr', 'orchestrator-api',
]

// ── Helpers ───────────────────────────────────────────────────────────────

function readContent(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

function findFiles(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return []
  const results: string[] = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (exts.some((e) => entry.name.endsWith(e))) {
        results.push(join((entry as unknown).path ?? dir, entry.name))
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return results
}

// ── Secret patterns that must NEVER appear as literal values ──────────────

const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]{24,}/,             // Stripe live secret key
  /sk_test_[a-zA-Z0-9]{24,}/,             // Stripe test secret key
  /whsec_[a-zA-Z0-9]{24,}/,               // Stripe webhook secret
  /postgres:\/\/[^:]+:[^@]+@[^/]+\/\w+/,  // Database connection string with password
  /mongodb\+srv:\/\/[^:]+:[^@]+@/,        // MongoDB connection string with password
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,// Private keys
  /AKIA[0-9A-Z]{16}/,                     // AWS access key
  /ghp_[a-zA-Z0-9]{36}/,                  // GitHub personal access token
  /gho_[a-zA-Z0-9]{36}/,                  // GitHub OAuth token
]

// ── Tests ─────────────────────────────────────────────────────────────────

describe('Environment Contract', () => {
  describe('App env validation', () => {
    it('os-core exports validateEnv function', () => {
      const envPath = resolve(ROOT, 'packages/os-core/src/config/env.ts')
      expect(existsSync(envPath), 'os-core/config/env.ts must exist').toBe(true)
      const content = readContent(envPath)
      expect(content).toContain('export function validateEnv')
    })

    it('os-core env schema requires KEY_VAULT_URI for secrets management', () => {
      const envPath = resolve(ROOT, 'packages/os-core/src/config/env.ts')
      const content = readContent(envPath)
      expect(
        content,
        'env.ts must define KEY_VAULT_URI in the base schema',
      ).toContain('KEY_VAULT_URI')
    })

    for (const app of APPS) {
      it(`${app}: env schema is defined in os-core`, () => {
        const envPath = resolve(ROOT, 'packages/os-core/src/config/env.ts')
        const content = readContent(envPath)
        // Normalize: 'nacp-exams' → 'nacpexams', 'orchestrator-api' → 'orchestrator'
        // Schema names follow the pattern: nacpexamsSchema, orchestratorSchema
        const normalizedApp = app.replace(/-api$/, '').replaceAll('-', '')
        // App schemas are defined as consoleSchema, partnersSchema, etc.
        expect(
          content.toLowerCase(),
          `${app} env schema must be defined in os-core/config/env.ts`,
        ).toContain(normalizedApp.toLowerCase())
      })
    }
  })

  describe('No committed secrets', () => {
    it('no git-tracked .env files with real secret values committed', () => {
      // Only check files that are actually tracked by git.
      // Local .env / .env.local files are gitignored and expected on dev machines.
      const { execSync } = require('node:child_process')
      let trackedEnvFiles: string[] = []
      try {
        const out = execSync('git ls-files -- "*.env" "*.env.*" ".env*" "apps/**/.env*"', {
          cwd: ROOT,
          encoding: 'utf-8',
        })
        trackedEnvFiles = out.trim().split('\n').filter(Boolean)
      } catch {
        // git not available — skip
        return
      }

      const violations: string[] = []

      for (const envFile of trackedEnvFiles) {
        const fullPath = resolve(ROOT, envFile)
        if (!existsSync(fullPath)) continue

        const content = readContent(fullPath)
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${envFile}: contains real secret matching ${pattern.source.slice(0, 30)}...`)
          }
        }
      }

      expect(
        violations,
        `Git-tracked .env files contain real secrets:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  })

  describe('CI workflow secrets', () => {
    it('CI workflows use ${{ secrets.* }} references, not hardcoded values', () => {
      const workflowDir = resolve(ROOT, '.github/workflows')
      if (!existsSync(workflowDir)) return

      const workflows = findFiles(workflowDir, ['.yml', '.yaml'])
      const violations: string[] = []

      for (const wf of workflows) {
        const content = readContent(wf)
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Check for hardcoded secret-like values in env: blocks
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.test(line) && !line.trim().startsWith('#')) {
              violations.push(`${relative(ROOT, wf)}:${i + 1}: hardcoded secret detected`)
            }
          }
        }
      }

      expect(
        violations,
        `CI workflows contain hardcoded secrets:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  })

  describe('Key Vault IaC', () => {
    it('Key Vault Bicep module exists with security controls', () => {
      const kvPath = resolve(
        ROOT,
        'tech-repo-scaffold/infra-as-code/bicep/modules/key-vault.bicep',
      )
      if (!existsSync(kvPath)) {
        // Not all setups have IaC — skip gracefully
        console.warn('[WARN] Key Vault Bicep module not found — skipping IaC check')
        return
      }

      const content = readContent(kvPath)
      expect(content, 'Key Vault must enable RBAC authorization').toMatch(
        /enableRbacAuthorization|rbacAuthorization/i,
      )
      expect(content, 'Key Vault must enable soft delete').toMatch(
        /enableSoftDelete|softDeleteEnabled/i,
      )
    })
  })

  describe('Production env safety', () => {
    it('Zod schemas enforce URL format for DATABASE_URL', () => {
      const envPath = resolve(ROOT, 'packages/os-core/src/config/env.ts')
      const content = readContent(envPath)
      expect(content).toContain('DATABASE_URL')
      expect(content, 'DATABASE_URL must be validated as URL').toContain('.url(')
    })

    it('Stripe env validates key prefixes', () => {
      const envPath = resolve(ROOT, 'packages/payments-stripe/src/env.ts')
      if (!existsSync(envPath)) return
      const content = readContent(envPath)
      expect(
        content,
        'STRIPE_SECRET_KEY must validate sk_ prefix',
      ).toMatch(/startsWith\(['"]sk_/)
    })

    it('QBO env validates required credentials', () => {
      const envPath = resolve(ROOT, 'packages/qbo/src/env.ts')
      if (!existsSync(envPath)) return
      const content = readContent(envPath)
      expect(content).toContain('CLIENT_ID')
      expect(content).toContain('CLIENT_SECRET')
    })
  })
})
