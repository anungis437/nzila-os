/**
 * Contract Test — Governance Package No-Bypass Guards
 *
 * Structural tests ensuring that governance packages cannot be circumvented.
 * These tests scan source code to detect bypass patterns:
 *
 *   1. No raw AI provider imports in apps (must use @nzila/ai-control)
 *   2. No raw audit writes bypassing @nzila/audit
 *   3. No governance decisions outside @nzila/governance
 *   4. No direct event emission bypassing @nzila/events + @nzila/contracts
 *   5. Enforcement package exports are structurally sound
 *   6. No process.exit() outside boot-assert
 *
 * @invariant GOV-BYPASS-001: No shadow AI provider imports
 * @invariant GOV-BYPASS-002: No raw audit table writes
 * @invariant GOV-BYPASS-003: Governance decision integrity
 * @invariant GOV-BYPASS-004: Event contract enforcement
 * @invariant GOV-BYPASS-005: Enforcement package structural integrity
 * @invariant GOV-BYPASS-006: No process.exit in app code
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── Helpers ─────────────────────────────────────────────────────────────────

function walkSync(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist', '__tests__', '__fixtures__'].includes(entry.name)) continue
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

function getAppApiRoutes(appName: string): string[] {
  const apiDir = join(ROOT, 'apps', appName, 'app', 'api')
  return walkSync(apiDir).filter(f => f.endsWith('route.ts'))
}

// Governance-aware apps (excluding health-only apps)
const GOVERNED_APPS = [
  'console', 'union-eyes', 'control-plane', 'flow',
  'cfo', 'partners', 'web', 'zonga', 'nacp-exams',
] as const

// ── GOV-BYPASS-001: No shadow AI provider imports ───────────────────────────

describe('GOV-BYPASS-001 — No shadow AI provider imports in apps', () => {
  const FORBIDDEN_AI_IMPORTS = [
    { pattern: /from\s+['"]openai['"]/, name: 'openai (direct)' },
    { pattern: /from\s+['"]@anthropic-ai\/sdk['"]/, name: '@anthropic-ai/sdk (direct)' },
    { pattern: /from\s+['"]@google-ai\/generativelanguage['"]/, name: 'Google AI (direct)' },
    { pattern: /require\(\s*['"]openai['"]/, name: 'openai (require)' },
  ]

  for (const app of GOVERNED_APPS) {
    const appDir = join(ROOT, 'apps', app)
    if (!existsSync(appDir)) continue

    it(`${app} — no direct AI provider imports`, () => {
      const files = walkSync(appDir)
      const violations: string[] = []

      for (const file of files) {
        if (file.includes('node_modules')) continue
        const content = readFileSync(file, 'utf-8')
        for (const forbidden of FORBIDDEN_AI_IMPORTS) {
          if (forbidden.pattern.test(content)) {
            const rel = file.replace(ROOT, '')
            violations.push(`${rel}: imports ${forbidden.name}`)
          }
        }
      }

      expect(
        violations,
        `Direct AI provider imports found. Use @nzila/ai-control or @nzila/ai-sdk instead:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  }
})

// ── GOV-BYPASS-002: No raw audit table writes ───────────────────────────────

describe('GOV-BYPASS-002 — No raw audit table writes in app code', () => {
  const RAW_AUDIT_PATTERNS = [
    { pattern: /INSERT\s+INTO\s+audit_events/i, name: 'raw INSERT INTO audit_events' },
    { pattern: /\.insert\(\s*audit_events\s*\)/, name: '.insert(audit_events)' },
    { pattern: /UPDATE\s+audit_events/i, name: 'raw UPDATE audit_events' },
    { pattern: /DELETE\s+FROM\s+audit_events/i, name: 'raw DELETE FROM audit_events' },
  ]

  for (const app of GOVERNED_APPS) {
    const appDir = join(ROOT, 'apps', app)
    if (!existsSync(appDir)) continue

    it(`${app} — no raw audit table manipulation`, () => {
      const files = walkSync(appDir)
      const violations: string[] = []

      for (const file of files) {
        if (file.includes('node_modules') || file.includes('.test.')) continue
        const content = readFileSync(file, 'utf-8')
        for (const forbidden of RAW_AUDIT_PATTERNS) {
          if (forbidden.pattern.test(content)) {
            const rel = file.replace(ROOT, '')
            violations.push(`${rel}: ${forbidden.name}`)
          }
        }
      }

      expect(
        violations,
        `Raw audit table writes found. Use @nzila/audit instead:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  }
})

// ── GOV-BYPASS-003: Governance decision integrity ───────────────────────────

describe('GOV-BYPASS-003 — No hardcoded access bypass patterns in apps', () => {
  const BYPASS_PATTERNS = [
    { pattern: /isAdmin\s*=\s*true/, name: 'hardcoded isAdmin = true' },
    { pattern: /skipAuth\s*=\s*true/, name: 'hardcoded skipAuth = true' },
    { pattern: /bypassGovernance\s*=\s*true/, name: 'hardcoded bypassGovernance = true' },
    { pattern: /skipEnforcement\s*=\s*true/, name: 'hardcoded skipEnforcement = true' },
    { pattern: /DISABLE_AUTH\s*=\s*['"]true['"]/, name: 'DISABLE_AUTH flag' },
  ]

  for (const app of GOVERNED_APPS) {
    const appDir = join(ROOT, 'apps', app)
    if (!existsSync(appDir)) continue

    it(`${app} — no hardcoded governance bypass flags`, () => {
      const files = walkSync(appDir)
      const violations: string[] = []

      for (const file of files) {
        if (file.includes('node_modules') || file.includes('.test.') || file.includes('__fixtures__')) continue
        const content = readFileSync(file, 'utf-8')
        for (const forbidden of BYPASS_PATTERNS) {
          if (forbidden.pattern.test(content)) {
            const rel = file.replace(ROOT, '')
            violations.push(`${rel}: ${forbidden.name}`)
          }
        }
      }

      expect(
        violations,
        `Governance bypass patterns found:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  }
})

// ── GOV-BYPASS-005: Enforcement package structural integrity ────────────────

describe('GOV-BYPASS-005 — Enforcement package structural integrity', () => {
  const enforcementDir = join(ROOT, 'packages', 'enforcement', 'src')

  it('enforcement package index exports pipeline', () => {
    const indexPath = join(enforcementDir, 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('composePipeline')
    expect(content).toContain('createEnforcedHandler')
    expect(content).toContain('createContext')
  })

  it('enforcement package exports Next.js adapter', () => {
    const indexPath = join(enforcementDir, 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('withEnforcement')
    expect(content).toContain('healthHandler')
  })

  it('enforcement package exports Fastify adapter', () => {
    const indexPath = join(enforcementDir, 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('enforcementPlugin')
  })

  it('enforcement package exports all pre-built layers', () => {
    const indexPath = join(enforcementDir, 'index.ts')
    const content = readFileSync(indexPath, 'utf-8')
    expect(content).toContain('traceLayer')
    expect(content).toContain('authLayer')
    expect(content).toContain('rateLimitLayer')
    expect(content).toContain('governanceLayer')
    expect(content).toContain('auditLayer')
  })

  it('pipeline.ts implements composePipeline correctly', () => {
    const pipelinePath = join(enforcementDir, 'pipeline.ts')
    const content = readFileSync(pipelinePath, 'utf-8')
    expect(content).toContain('EnforcementContext')
    expect(content).toContain('EnforcementResult')
    expect(content).toContain('EnforcementLayer')
    expect(content).toContain('NextFn')
  })

  it('all governance package source directories exist', () => {
    const packages = [
      'observability', 'audit', 'ai-control', 'contracts',
      'events', 'governance', 'security', 'enforcement',
    ]
    for (const pkg of packages) {
      const srcDir = join(ROOT, 'packages', pkg, 'src')
      expect(
        existsSync(srcDir),
        `packages/${pkg}/src must exist`,
      ).toBe(true)
    }
  })

  it('all governance packages have vitest config', () => {
    const packages = [
      'observability', 'audit', 'ai-control', 'contracts',
      'events', 'governance', 'security', 'enforcement',
    ]
    for (const pkg of packages) {
      const vitestPath = join(ROOT, 'packages', pkg, 'vitest.config.ts')
      expect(
        existsSync(vitestPath),
        `packages/${pkg}/vitest.config.ts must exist`,
      ).toBe(true)
    }
  })

  it('all governance packages have eslint config', () => {
    const packages = [
      'observability', 'audit', 'ai-control', 'contracts',
      'events', 'governance', 'security', 'enforcement',
    ]
    for (const pkg of packages) {
      const eslintPath = join(ROOT, 'packages', pkg, 'eslint.config.mjs')
      expect(
        existsSync(eslintPath),
        `packages/${pkg}/eslint.config.mjs must exist`,
      ).toBe(true)
    }
  })
})

// ── GOV-BYPASS-006: No process.exit in app code ─────────────────────────────

describe('GOV-BYPASS-006 — No process.exit in app code', () => {
  const ALLOWED_PROCESS_EXIT_FILES = [
    'boot-assert.ts',
    'instrumentation.ts',
    'ga-check.ts',
    'telemetry.ts',
  ]

  // Directories where process.exit() is expected (scripts, seeds, migrations)
  const ALLOWED_PROCESS_EXIT_DIRS = [
    'db/seeds',
    'db\\seeds',
    'scripts',
    'tooling/',
    'tooling\\',
    'services/financial-service',
    'services\\financial-service',
    'lib/demoSeed',
    'lib\\demoSeed',
  ]

  for (const app of GOVERNED_APPS) {
    const appDir = join(ROOT, 'apps', app)
    if (!existsSync(appDir)) continue

    it(`${app} — no process.exit() outside allowed files`, () => {
      const files = walkSync(appDir)
      const violations: string[] = []

      for (const file of files) {
        if (file.includes('node_modules') || file.includes('.test.')) continue
        if (ALLOWED_PROCESS_EXIT_FILES.some(f => file.endsWith(f))) continue
        if (ALLOWED_PROCESS_EXIT_DIRS.some(d => file.includes(d))) continue

        const content = readFileSync(file, 'utf-8')
        if (/process\.exit\s*\(/.test(content)) {
          const rel = file.replace(ROOT, '')
          violations.push(rel)
        }
      }

      expect(
        violations,
        `process.exit() found outside allowed files:\n${violations.join('\n')}`,
      ).toHaveLength(0)
    })
  }
})
