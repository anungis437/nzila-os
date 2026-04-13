/**
 * Contract test: Auth Purity — Zero Conceptual Leakage
 *
 * AUTH-001: No Clerk-style naming outside adapter/compat layers
 * AUTH-002: All internal logic uses orgId/userId (no clerkId/clerkUserId)
 * AUTH-003: No Clerk SDK imports outside platform-auth package
 *
 * Allowed exceptions:
 *   - packages/platform-auth/** (the adapter layer itself)
 *   - migration docs (docs/platform/auth-migration*.md, MIGRATION_NOTES.md)
 *   - CHANGELOG.md, git history references
 *   - backward-compat aliases (clearly marked with "compat" or "legacy")
 *   - Comments explicitly saying "replaced Clerk" or "migrated from Clerk"
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')
const APPS_DIR = join(ROOT, 'apps')
const PACKAGES_DIR = join(ROOT, 'packages')

/** Directories that are allowed to reference Clerk (adapter/compat layer) */
const ALLOWED_DIRS = new Set([
  'platform-auth',       // the auth adapter itself
])

/** Files that are allowed to reference Clerk (docs, changelogs) */
const ALLOWED_FILE_PATTERNS = [
  /CHANGELOG/i,
  /MIGRATION/i,
  /auth-migration/i,
  /\.md$/,              // documentation is OK
]

/** Patterns that indicate Clerk-style naming in code (not just mentions) */
const CLERK_CODE_PATTERNS = [
  /\bclerkId\b/,
  /\bclerkUserId\b/,
  /\bclerkOrgId\b/,
  /\bclerk_id\b/,
  /\bclerk_user_id\b/,
  /\bclerk_org_id\b/,
  /\bClerkProvider\b/,
  /\buseClerk\b/,
]

/** Clerk SDK import patterns */
const CLERK_IMPORT_PATTERNS = [
  /from\s+['"]@clerk\//,
  /require\(\s*['"]@clerk\//,
]

function collectTSFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const found: string[] = []
  const stack = [dir]
  while (stack.length > 0) {
    const d = stack.pop()!
    let entries: import('node:fs').Dirent[]
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', '.next', '.turbo', 'drizzle', 'migrations'].includes(e.name)) continue
        stack.push(full)
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
        found.push(full)
      }
    }
  }
  return found
}

function isAllowedFile(filePath: string): boolean {
  return ALLOWED_FILE_PATTERNS.some(p => p.test(filePath))
}

function isInAllowedDir(filePath: string): boolean {
  const rel = filePath.replace(ROOT, '').replace(/\\/g, '/')
  for (const dir of ALLOWED_DIRS) {
    if (rel.includes(`/${dir}/`)) return true
  }
  return false
}

function isCompatComment(line: string): boolean {
  // Lines that are clearly backward-compat aliases or migration comments
  return /compat|legacy|backward|migrated|replaced|alias/i.test(line)
}

// ── AUTH-001: No Clerk-style naming in app source ───────────────────────────

describe('AUTH-001: No Clerk-style naming outside adapters', () => {
  const apps = readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)

  for (const app of apps) {
    it(`${app} has no Clerk-style variable names`, () => {
      const files = collectTSFiles(join(APPS_DIR, app))
      const violations: string[] = []

      for (const file of files) {
        if (isAllowedFile(file)) continue
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Skip comments
          if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) {
            if (isCompatComment(line)) continue
            // Still skip pure comment lines
            continue
          }

          for (const pattern of CLERK_CODE_PATTERNS) {
            if (pattern.test(line)) {
              const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '')
              violations.push(`${rel}:${i + 1}`)
              break
            }
          }
        }
      }

      expect(
        violations,
        `${app} has Clerk-style naming — use orgId/userId instead: ${violations.join(', ')}`,
      ).toHaveLength(0)
    })
  }
})

// ── AUTH-002: Packages use orgId/userId not clerkId ─────────────────────────

describe('AUTH-002: Packages use orgId/userId not Clerk-style ids', () => {
  const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .filter(e => !ALLOWED_DIRS.has(e.name))
    .map(e => e.name)

  for (const pkg of packages) {
    it(`${pkg} has no Clerk-style identifiers`, () => {
      const files = collectTSFiles(join(PACKAGES_DIR, pkg))
      const violations: string[] = []

      for (const file of files) {
        if (isAllowedFile(file)) continue
        const content = readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue

          for (const pattern of CLERK_CODE_PATTERNS) {
            if (pattern.test(line)) {
              if (isCompatComment(line)) continue
              const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '')
              violations.push(`${rel}:${i + 1}`)
              break
            }
          }
        }
      }

      expect(
        violations,
        `${pkg} has Clerk-style naming: ${violations.join(', ')}`,
      ).toHaveLength(0)
    })
  }
})

// ── AUTH-003: No Clerk SDK imports outside platform-auth ─────────────────────

describe('AUTH-003: No @clerk/* imports outside platform-auth', () => {
  const allDirs = [
    ...readdirSync(APPS_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => join(APPS_DIR, e.name)),
    ...readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && !ALLOWED_DIRS.has(e.name))
      .map(e => join(PACKAGES_DIR, e.name)),
  ]

  it('no @clerk/* imports found outside platform-auth', () => {
    const violations: string[] = []

    for (const dir of allDirs) {
      const files = collectTSFiles(dir)
      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        for (const pattern of CLERK_IMPORT_PATTERNS) {
          if (pattern.test(content)) {
            const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '')
            violations.push(rel)
            break
          }
        }
      }
    }

    expect(
      violations,
      `Clerk SDK imports found outside platform-auth — use @nzila/platform-auth instead: ${violations.join(', ')}`,
    ).toHaveLength(0)
  })
})
