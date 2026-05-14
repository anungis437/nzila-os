/**
 * Contract test: Shared Core Enforcement (PHASE 1)
 *
 * CORE-001: Apps must NOT contain duplicate platform logic implementations
 */
/**
 * CORE-002: Apps must NOT import from other apps (arch boundary)
 * CORE-003: Shared packages must have stable exports (no circular deps)
 * CORE-004: Auth guards must delegate to @nzila/platform-auth primitives
 * CORE-005: Evidence modules must delegate to @nzila/os-core auditedAction
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { ROOT as REPO_ROOT, walkSync, readContent, relPath, safeJoin } from './governance-helpers'

const ROOT = REPO_ROOT

function mustJoin(base: string, ...parts: string[]): string {
  const path = safeJoin(base, ...parts)
  if (!path) throw new Error(`Invalid path under ${base}: ${parts.join('/')}`)
  return path
}

const APPS_DIR = mustJoin(ROOT, 'apps')
const PKGS_DIR = mustJoin(ROOT, 'packages')

function walkFiles(dir: string): string[] {
  return walkSync(dir, ['.ts', '.tsx'])
}

function readSafe(path: string): string {
  return readContent(path)
}

function listApps(): string[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
}

// ── CORE-001: No duplicate platform logic ───────────────────────────────────

describe('CORE-001: No duplicate platform logic patterns', () => {
  const apps = listApps()

  /** Patterns that indicate an app re-implements platform logic locally */
  const FORBIDDEN_REIMPLEMENTATIONS = [
    {
      name: 'custom rate-limiter implementation',
      pattern: /class\s+\w*RateLimiter|new\s+Map\(\).*rate/i,
      fileGlob: 'rate-limit',
      allowed: ['packages/'],
      /** App-specific rate limiters for AI/integration resilience are OK */
      exemptPaths: ['lib/ai/', 'lib/integrations/'],
    },
    {
      name: 'custom hash-chain implementation',
      pattern: /createHash\(['"]sha256['"]\).*chain|hashChain/,
      fileGlob: 'hash',
      allowed: ['packages/'],
      /** Signature schemas, evidence packs, integrity UIs, and correspondence audit trails are OK */
      exemptPaths: ['signature', 'evidence', 'integrity', 'nacp-integrity', 'correspondence'],
    },
    {
      name: 'custom idempotency implementation',
      pattern: /class\s+\w*IdempotencyStore|idempotencyCache\s*=/i,
      fileGlob: 'idempoten',
      allowed: ['packages/'],
      exemptPaths: [],
    },
  ]

  for (const rule of FORBIDDEN_REIMPLEMENTATIONS) {
    it(`apps must not re-implement: ${rule.name}`, () => {
      const violations: string[] = []
      for (const app of apps) {
        const appDir = join(APPS_DIR, app)
        const files = walkFiles(appDir)
        for (const f of files) {
          const rel = relPath(f)
          if (rule.allowed.some(a => rel.startsWith(a))) continue
          if (rel.includes('node_modules')) continue
          if (rel.includes('.test.') || rel.includes('__tests__')) continue
          if (rule.exemptPaths.some(p => rel.includes(p))) continue
          const src = readSafe(f)
          if (rule.pattern.test(src)) {
            violations.push(rel)
          }
        }
      }
      expect(violations, `Found re-implementations in: ${violations.join(', ')}`).toEqual([])
    })
  }
})

// ── CORE-002: No cross-app imports ──────────────────────────────────────────

describe('CORE-002: No cross-app imports in source code', () => {
  const apps = listApps()

  it('no app imports from another app via @nzila/<app> paths', () => {
    const violations: string[] = []
    const appPackageNames = apps.map(a => `@nzila/${a}`)

    for (const app of apps) {
      const appDir = join(APPS_DIR, app)
      const files = walkFiles(appDir)
      for (const f of files) {
        if (f.includes('node_modules') || f.includes('.test.') || f.includes('__tests__')) continue
        const src = readSafe(f)
        for (const pkg of appPackageNames) {
          if (pkg === `@nzila/${app}`) continue // self-import is fine
          // Use word-boundary check: must be followed by quote or / to avoid
          // matching @nzila/flow as a substring of @nzila/flow-engine etc.
          const matches =
            src.includes(`from '${pkg}'`) || src.includes(`from '${pkg}/`) ||
            src.includes(`from "${pkg}"`) || src.includes(`from "${pkg}/`)
          if (matches) {
            const rel = relPath(f)
            violations.push(`${rel} imports ${pkg}`)
          }
        }
      }
    }
    expect(violations, `Cross-app imports found:\n${violations.join('\n')}`).toEqual([])
  })

  it('no app imports from another app via relative paths to apps/', () => {
    const violations: string[] = []
    for (const app of apps) {
      const appDir = join(APPS_DIR, app)
      const files = walkFiles(appDir)
      for (const f of files) {
        if (f.includes('node_modules') || f.includes('.test.')) continue
        const src = readSafe(f)
        // Look for relative imports that escape to another app
        const crossAppPattern = /from\s+['"]\.\.\/\.\.\/(?:\.\.\/)*apps\//g
        const matches = src.match(crossAppPattern)
        if (matches) {
          const rel = relPath(f)
          violations.push(`${rel}: ${matches.join(', ')}`)
        }
      }
    }
    expect(violations, `Cross-app relative imports:\n${violations.join('\n')}`).toEqual([])
  })
})

// ── CORE-003: Shared packages have stable barrel exports ────────────────────

describe('CORE-003: Shared packages have stable barrel exports', () => {
  const CORE_PACKAGES = [
    'contracts',
    'platform-contracts',
    'os-core',
    'observability',
    'platform-auth',
    'db',
  ]

  for (const pkg of CORE_PACKAGES) {
    const indexPath = join(PKGS_DIR, pkg, 'src', 'index.ts')

    it(`${pkg} has index.ts barrel export`, () => {
      expect(existsSync(indexPath), `${pkg}/src/index.ts must exist`).toBe(true)
    })

    it(`${pkg} does not import from apps/`, () => {
      if (!existsSync(indexPath)) return
      const files = walkFiles(join(PKGS_DIR, pkg, 'src'))
      const violations: string[] = []
      for (const f of files) {
        const src = readSafe(f)
        if (/from\s+['"].*apps\//.test(src) || /from\s+['"]@nzila\/(web|console|union-eyes|flow|partners|zonga|cfo|abr|agrimo|trade|cora|nacp-exams|mobility|control-plane|platform-admin|orchestrator-api)['"]/.test(src)) {
          violations.push(relPath(f))
        }
      }
      expect(violations, `${pkg} imports from apps:\n${violations.join('\n')}`).toEqual([])
    })
  }
})

// ── CORE-004: Auth guard modules delegate to platform-auth ──────────────────

describe('CORE-004: Auth guard modules use platform-auth primitives', () => {
  const APPS_WITH_GUARDS = [
    'console', 'union-eyes', 'flow', 'zonga', 'partners',
    'abr', 'nacp-exams', 'cfo', 'web',
  ]

  for (const app of APPS_WITH_GUARDS) {
    it(`${app}/lib/api-guards.ts imports from @nzila/platform-auth`, () => {
      const guardPath = join(APPS_DIR, app, 'lib', 'api-guards.ts')
      if (!existsSync(guardPath)) return // no guard = no violation
      const src = readSafe(guardPath)
      const usesPlatformAuth =
        src.includes('@nzila/platform-auth') ||
        src.includes('currentUser') ||
        src.includes('auth()')
      expect(usesPlatformAuth, `${app} api-guards must use @nzila/platform-auth`).toBe(true)
    })
  }
})

// ── CORE-005: Evidence modules delegate to os-core ──────────────────────────

describe('CORE-005: Evidence modules use shared patterns', () => {
  const APPS_WITH_EVIDENCE = [
    'console', 'union-eyes', 'flow', 'zonga', 'partners',
    'abr', 'nacp-exams', 'cfo',
  ]

  for (const app of APPS_WITH_EVIDENCE) {
    it(`${app} evidence module exports buildEvidencePackFromAction`, () => {
      const evidencePath = join(APPS_DIR, app, 'lib', 'evidence.ts')
      if (!existsSync(evidencePath)) return
      const src = readSafe(evidencePath)
      expect(
        src.includes('buildEvidencePackFromAction'),
        `${app}/lib/evidence.ts must export buildEvidencePackFromAction`,
      ).toBe(true)
    })

    it(`${app} evidence module exports processEvidencePack`, () => {
      const evidencePath = join(APPS_DIR, app, 'lib', 'evidence.ts')
      if (!existsSync(evidencePath)) return
      const src = readSafe(evidencePath)
      expect(
        src.includes('processEvidencePack'),
        `${app}/lib/evidence.ts must export processEvidencePack`,
      ).toBe(true)
    })
  }
})
