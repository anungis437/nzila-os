/**
 * SERVER_ACTION_AUTH_REQUIRED_001 — "Every server action file must gate on authentication"
 *
 * Repo-wide invariant: Every file containing `'use server'` must call at least
 * one auth guard at the module or function level. This catches fully
 * unauthenticated server actions that can be invoked by any client.
 *
 * Recognised auth patterns:
 *   - auth()                — Clerk auth
 *   - resolveOrgContext()   — Org-scoped auth wrapper
 *   - requireAuth()         — UE RBAC auth
 *   - requireAdmin()        — UE admin gate
 *   - requirePermission()   — CFO permission gate
 *   - requirePlatformAdmin()— Partners admin gate
 *   - requireUser()         — UE API auth guard
 *   - requireApiAuth()      — API auth guard
 *   - getCurrentUserOrgId() — UE org-context helper (internally calls auth())
 *   - checkAdminRole()      — UE admin helper (internally calls auth())
 *
 * Allowlisted:
 *   - Status/health actions (read-only system info)
 *   - Files listed in governance/exceptions/server-action-auth.json
 *
 * @invariant SERVER_ACTION_AUTH_REQUIRED_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import {
  ROOT,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

const APPS_DIR = join(ROOT, 'apps')

/** Patterns recognised as authentication guards */
const AUTH_PATTERNS = [
  'auth(',
  'resolveOrgContext(',
  'requireAuth(',
  'requireAdmin(',
  'requirePermission(',
  'requirePlatformAdmin(',
  'requireUser(',
  'requireApiAuth(',
  'getCurrentUserOrgId(',
  'checkAdminRole(',
  'requireAnyPermission(',
  'requireAllPermissions(',
  'requireUnionRepOrHigher(',
  'withApiAuth(',
  'withRoleAuth(',
]

/** Paths explicitly allowed to have no auth (e.g. health/status endpoints, DAL layers) */
const ALLOWLISTED_PATHS = [
  'lib/monitoring/status-actions.ts', // Read-only system status
  'lib/monitoring/status-page',       // Status page helpers
  'db/queries/',                      // DAL layer — auth enforced by calling server actions
]

function walkServerActionFiles(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist', '__pycache__', 'backend', '.venv'].includes(entry.name)) continue
      results.push(...walkServerActionFiles(fullPath))
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      const content = readFileSync(fullPath, 'utf-8')
      if (content.includes("'use server'") || content.includes('"use server"')) {
        results.push(fullPath)
      }
    }
  }
  return results
}

function hasAuthGuard(content: string): boolean {
  return AUTH_PATTERNS.some(p => content.includes(p))
}

// ── SERVER_ACTION_AUTH_REQUIRED_001 ─────────────────────────────────────────

describe('SERVER_ACTION_AUTH_REQUIRED_001 — Every server action must gate on authentication', () => {
  it('every "use server" file across all apps calls an auth guard', () => {
    const violations: Violation[] = []
    const exceptionFile = loadExceptions(
      'governance/exceptions/server-action-auth.json',
    )

    const allActionFiles = walkServerActionFiles(APPS_DIR)

    for (const file of allActionFiles) {
      const rel = relative(ROOT, file).split(sep).join('/')

      // Check allowlist
      if (ALLOWLISTED_PATHS.some(a => rel.includes(a))) continue
      if (isExcepted(rel, exceptionFile.entries)) continue

      const content = readFileSync(file, 'utf-8')
      if (!hasAuthGuard(content)) {
        violations.push({
          ruleId: 'SERVER_ACTION_AUTH_REQUIRED_001',
          filePath: rel,
          offendingValue: 'No authentication guard found in server action file',
          remediation:
            'Add auth(), resolveOrgContext(), requireAuth(), or equivalent auth guard to every exported server action',
        })
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('no expired exceptions for SERVER_ACTION_AUTH_REQUIRED_001', () => {
    const exceptionFile = loadExceptions(
      'governance/exceptions/server-action-auth.json',
    )
    expect(
      exceptionFile.expiredEntries,
      `${exceptionFile.expiredEntries.length} expired exception(s)`,
    ).toHaveLength(0)
  })
})
