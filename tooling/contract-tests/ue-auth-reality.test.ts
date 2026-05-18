/**
 * UE_AUTH_REALITY_001 — Clerk stale reference regression guard
 *
 * Prevents the Clerk auth provider (removed from UE stack) from re-entering
 * active UE runtime files, docs, and machine-readable metadata.
 *
 * Rationale: Phase A removed all Clerk references from UE. This test ensures
 * future changes cannot accidentally reintroduce Clerk as a claimed dependency.
 *
 * Explicitly allowed:
 *   - apps/union-eyes/docs/AUTH_REALITY_AUDIT.md (intentional historical log)
 *   - apps/union-eyes/db/schema/** (legacy `clerk_id` column names in DB)
 *   - backend/docs/archive/** (historical archived docs from Clerk era)
 *   - packages/platform-auth/** (platform-level compat shim, not UE runtime)
 *   - tooling/contract-tests/ue-auth-reality.test.ts (this file)
 *
 * @invariant UE_AUTH_REALITY_001
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, openSync, fstatSync, readSync, closeSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const ROOT = join(__dirname, '..', '..')

const SEARCH_PATTERNS = [
  // Explicit Clerk SDK / service name
  /\bClerk\b/,
  /\bclerk\b/,
  /\bCLERK\b/,
  // Clerk environment variable names (the real vendor vars, not auth-related vars)
  /CLERK_SECRET_KEY/,
  /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/,
  /NEXT_PUBLIC_CLERK_SIGN_IN_URL/,
  /NEXT_PUBLIC_CLERK_SIGN_UP_URL/,
  /CLERK_WEBHOOK_SECRET/,
  // Clerk NPM packages
  /@clerk\//,
  /clerk\/nextjs/,
]

/**
 * Files/directories that are allowed to contain Clerk references.
 * These are intentional: historical docs, DB schema legacy columns,
 * platform compat shims, test data using "clerk" as an occupation title,
 * and this test file itself.
 */
const ALLOWED_PATTERNS = [
  // The audit doc that intentionally catalogs Clerk refs (moved to docs/security/)
  'apps/union-eyes/docs/security/AUTH_REALITY_AUDIT.md',
  // The Phase A validation doc that documents the remediation (moved to docs/operations/)
  'apps/union-eyes/docs/operations/PHASE_A_PRODUCTION_INFRA_VALIDATION.md',
  // Legacy DB column names (not active Clerk SDK usage)
  'apps/union-eyes/db/schema/',
  'apps/union-eyes/db/migrations/',
  // Historical archived docs from Clerk era
  'backend/docs/archive/',
  // Platform-auth package level: may have compat shim
  'packages/platform-auth/',
  // This test file
  'tooling/contract-tests/ue-auth-reality.test.ts',
  // Test fixture files that use "Clerk" as a labour-market job title/classification (not the auth vendor)
  'apps/union-eyes/lib/validation/__tests__/member-employment-schemas.test.ts',
  'apps/union-eyes/lib/__tests__/clause-service.test.ts',
  // ML client test uses "clerk-token" as a mock token string — not an auth vendor reference
  'apps/union-eyes/lib/__tests__/ml-client.test.ts',
  // Domain/role files: "clerk" is the union recording-clerk role (Admin Clerk), not the auth vendor
  'apps/union-eyes/lib/auth/roles.ts',
  // rbac-server.ts: 'clerk': UserRole.CLERK is the union officer role mapping, not auth vendor
  'apps/union-eyes/lib/auth/rbac-server.ts',
  // role-access-flows tests: UserRole.CLERK domain role tests
  'apps/union-eyes/lib/auth/__tests__/role-access-flows.test.ts',
  // Committee and correspondence UI: "clerk" is the union officer role used in role-based UI gating
  'apps/union-eyes/app/[locale]/dashboard/committees/',
  'apps/union-eyes/app/[locale]/dashboard/correspondence/',
  // role-experience.ts: 'clerk' is the union role string value
  'apps/union-eyes/lib/dashboard/role-experience.ts',
  // MODULE_PAGE_INVENTORY.md: `clerk` is the union officer role name (recording clerk), not auth vendor (moved to docs/governance/)
  'apps/union-eyes/docs/governance/MODULE_PAGE_INVENTORY.md',
]

/**
 * Active UE scan scope: runtime and documentation only.
 * Does NOT scan the full repo — only UE-specific files.
 */
const UE_SCAN_DIRS = [
  join(ROOT, 'apps', 'union-eyes', 'app'),
  join(ROOT, 'apps', 'union-eyes', 'lib'),
  join(ROOT, 'apps', 'union-eyes', 'components'),
  join(ROOT, 'apps', 'union-eyes', 'hooks'),
  join(ROOT, 'apps', 'union-eyes', 'tests'),
  join(ROOT, 'apps', 'union-eyes', 'docs'),
  join(ROOT, 'apps', 'union-eyes', 'public'),
]

const PLATFORM_REGISTRY_FILES = [
  join(ROOT, 'platform', 'registry', 'apps.json'),
  join(ROOT, 'platform', 'products', 'union-eyes.json'),
  join(ROOT, 'apps', 'union-eyes', 'catalog-info.yaml'),
]

const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.md', '.mdx'])

interface Violation {
  file: string
  line: number
  pattern: string
  text: string
}

function readFileContent(filePath: string): string {
  const fd = openSync(filePath, 'r')
  try {
    const size = fstatSync(fd).size
    if (size === 0) return ''
    const buf = Buffer.alloc(size)
    readSync(fd, buf, 0, size, 0)
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

function isAllowed(relFilePath: string): boolean {
  const normalized = relFilePath.replace(/\\/g, '/')
  return ALLOWED_PATTERNS.some((pattern) => normalized.includes(pattern))
}

function walkDir(dir: string): string[] {
  const results: string[] = []
  let entries: ReturnType<typeof readdirSync>
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip node_modules and .next build artifacts
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.turbo') continue
      results.push(...walkDir(full))
    } else if (entry.isFile() && SCAN_EXTS.has(extname(entry.name))) {
      results.push(full)
    }
  }
  return results
}

function scanFile(filePath: string): Violation[] {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/')
  if (isAllowed(rel)) return []

  let content: string
  try {
    content = readFileContent(filePath)
  } catch {
    return []
  }

  const violations: Violation[] = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    for (const pattern of SEARCH_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          pattern: pattern.source,
          text: line.trim().slice(0, 120),
        })
        break // one violation per line per file is enough
      }
    }
  }
  return violations
}

describe('UE_AUTH_REALITY_001 — Clerk stale reference regression guard', () => {
  it('finds no Clerk references in active UE runtime files', () => {
    const violations: Violation[] = []

    for (const dir of UE_SCAN_DIRS) {
      const files = walkDir(dir)
      for (const file of files) {
        violations.push(...scanFile(file))
      }
    }

    if (violations.length > 0) {
      const formatted = violations
        .map((v) => `  ${v.file}:${v.line}  [${v.pattern}]  ${v.text}`)
        .join('\n')
      throw new Error(
        `UE_AUTH_REALITY_001: ${violations.length} stale Clerk reference(s) found in active UE files.\n` +
          `These must be removed. Allowed exceptions: AUTH_REALITY_AUDIT.md, db/schema/, backend/docs/archive/, packages/platform-auth/.\n\n` +
          formatted
      )
    }

    expect(violations).toHaveLength(0)
  })

  it('finds no Clerk references in machine-readable UE registry/metadata', () => {
    const violations: Violation[] = []

    for (const filePath of PLATFORM_REGISTRY_FILES) {
      violations.push(...scanFile(filePath))
    }

    if (violations.length > 0) {
      const formatted = violations
        .map((v) => `  ${v.file}:${v.line}  [${v.pattern}]  ${v.text}`)
        .join('\n')
      throw new Error(
        `UE_AUTH_REALITY_001: ${violations.length} stale Clerk reference(s) found in UE registry/metadata.\n\n` +
          formatted
      )
    }

    expect(violations).toHaveLength(0)
  })
})
