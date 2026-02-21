/**
 * PR0.2b — Repo Invariant Tests
 *
 * These tests enforce the architectural invariants documented in
 * docs/repo-contract/invariants.md.
 *
 * Every invariant here must reference its exact enforcement mechanism.
 * Golden Rule: code gates, not intent.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const APPS = ['console', 'partners', 'web', 'union-eyes']

// ── Helper: read all .ts/.tsx files in a directory recursively ────────────

async function findFiles(dir: string, exts = ['.ts', '.tsx', '.mjs']): Promise<string[]> {
  if (!existsSync(dir)) return []
  const results: string[] = []

  function recurse(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      // Never descend into node_modules (hoisted pnpm creates per-app node_modules on CI)
      if (entry.name === 'node_modules') continue
      // Also skip .next, .turbo build artifacts
      if (entry.name === '.next' || entry.name === '.turbo') continue
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        recurse(fullPath)
      } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e))) {
        results.push(fullPath)
      }
    }
  }

  recurse(dir)
  return results
}

function readContent(path: string): string {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return ''
  }
}

// ── INV-01: No shadow AI ────────────────────────────────────────────────────
// Apps must NOT import provider AI SDKs directly.
// Enforcement: eslint-no-shadow-ai rule must be enabled in every app.

const AI_PROVIDER_IMPORTS = [
  /^import\s+.*\bfrom\s+['"]openai['"]/m,
  /^import\s+.*\bfrom\s+['"]@azure\/openai['"]/m,
  /^import\s+.*\bfrom\s+['"]anthropic['"]/m,
  /^import\s+.*\bfrom\s+['"]@anthropic-ai\//m,
  /^import\s+.*\bfrom\s+['"]@google\/generative-ai['"]/m,
  /^import\s+.*\bfrom\s+['"]cohere-ai['"]/m,
]

describe('INV-01: no-shadow-ai', () => {
  it('every app eslint config enables no-shadow-ai rule', async () => {
    for (const app of APPS) {
      const eslintPath = resolve(ROOT, `apps/${app}/eslint.config.mjs`)
      if (!existsSync(eslintPath)) continue
      const content = readContent(eslintPath)
      expect(content, `apps/${app}/eslint.config.mjs must reference no-shadow-ai`).toMatch(
        /no-shadow-ai|noShadowAi|eslint-no-shadow-ai/,
      )
    }
  })

  it('no app file directly imports provider AI SDK (static imports)', async () => {
    const violations: string[] = []
    for (const app of APPS) {
      const appSrcDir = resolve(ROOT, `apps/${app}`)
      const files = await findFiles(appSrcDir)
      for (const file of files) {
        const content = readContent(file)
        for (const pattern of AI_PROVIDER_IMPORTS) {
          if (pattern.test(content)) {
            violations.push(`${file}: contains direct provider AI import`)
          }
        }
      }
    }
    expect(
      violations,
      `Shadow AI imports detected:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})

// ── INV-02: No shadow ML (direct table reads) ──────────────────────────────
// Apps must NOT import ML tables (mlScores*, mlModels, mlDatasets) directly.
// Enforcement: no-shadow-ml ESLint rule + this contract test.

const ML_TABLE_IMPORTS = [
  /mlScoresStripeTxn/,
  /mlScoresStripeDaily/,
  /mlScoresUECasesPriority/,
  /mlScoresUESlaRisk/,
  /mlModels\b/,
  /mlDatasets\b/,
  /mlTrainingRuns/,
  /mlInferenceRuns/,
]

describe('INV-02: no-shadow-ml', () => {
  it('no app file directly imports ML tables from @nzila/db/schema', async () => {
    const violations: string[] = []
    for (const app of APPS) {
      const appSrcDir = resolve(ROOT, `apps/${app}`)
      const files = await findFiles(appSrcDir)
      for (const file of files) {
        // apps/console/app/api/ml/** routes ARE the ml-sdk HTTP backend — they are
        // the server-side implementation of the SDK and are authorised to read ML tables.
        if (file.replace(/\\/g, '/').includes('/apps/console/app/api/ml/')) continue
        const content = readContent(file)
        // Only flag files that import from @nzila/db/schema AND reference ML tables
        if (!content.includes('@nzila/db')) continue
        for (const pattern of ML_TABLE_IMPORTS) {
          if (pattern.test(content)) {
            violations.push(`${file}: direct ML table access detected`)
          }
        }
      }
    }
    expect(
      violations,
      `Shadow ML reads detected:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})

// ── INV-03: Evidence generator is canonical ────────────────────────────────
// Only os-core may define evidence generator business logic.
// The tooling/scripts wrapper must be thin (`no-duplicate-evidence-generator` test
// covers the full assertion; this test verifies the package.json export surface).

describe('INV-03: evidence generator SSoT', () => {
  it('os-core package.json exports evidence/generate-evidence-index', () => {
    const pkgPath = resolve(ROOT, 'packages/os-core/package.json')
    const pkg = JSON.parse(readContent(pkgPath))
    expect(pkg.exports?.['./evidence/generate-evidence-index']).toBeTruthy()
  })

  it('tooling wrapper must not define UploadContext interface', () => {
    const wrapperPath = resolve(ROOT, 'tooling/scripts/generate-evidence-index.ts')
    const content = readContent(wrapperPath)
    expect(content).not.toMatch(/interface\s+UploadContext\b/)
  })

  it('tooling wrapper must not define EvidencePackIndex interface', () => {
    const wrapperPath = resolve(ROOT, 'tooling/scripts/generate-evidence-index.ts')
    const content = readContent(wrapperPath)
    expect(content).not.toMatch(/interface\s+EvidencePackIndex\b/)
  })
})

// ── INV-04: All apps must have authorize() from os-core policy ─────────────
// API routes in apps must call authorize() before returning data.
// This is partially enforced by api-authz-coverage.test.ts (full coverage).
// Here we assert that the policy package exists and is properly exported.

describe('INV-04: RBAC policy engine exists', () => {
  it('os-core exports policy/index', () => {
    const pkgPath = resolve(ROOT, 'packages/os-core/package.json')
    const pkg = JSON.parse(readContent(pkgPath))
    expect(pkg.exports?.['./policy']).toMatch(/policy\/index\.ts/)
  })

  it('os-core/src/policy/authorize.ts exports authorize function', () => {
    const authorizePath = resolve(ROOT, 'packages/os-core/src/policy/authorize.ts')
    expect(existsSync(authorizePath)).toBe(true)
    const content = readContent(authorizePath)
    expect(content).toMatch(/export.*function\s+authorize\b|export\s+\{.*\bauthorize\b/)
  })
})

// ── INV-05: No DEFAULT_ENTITY_ID pattern in partners app ──────────────────
// Partners app must use partner_entities entitlements, never a hardcoded entity.

describe('INV-05: no DEFAULT_ENTITY_ID in partners', () => {
  it('partners app must not use DEFAULT_ENTITY_ID pattern', async () => {
    const partnersDir = resolve(ROOT, 'apps/partners')
    const files = await findFiles(partnersDir)
    const violations: string[] = []
    for (const file of files) {
      const content = readContent(file)
      if (content.includes('DEFAULT_ENTITY_ID')) {
        violations.push(file)
      }
    }
    expect(
      violations,
      `DEFAULT_ENTITY_ID found in partners:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})
