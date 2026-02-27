/**
 * ORG_REQUIRED_SERVER_ACTIONS_001 — "Server actions must use resolveOrgContext"
 *
 * Enforces that every server action file across all apps uses the
 * org-scoped auth helper (resolveOrgContext) instead of bare auth()
 * from Clerk.
 *
 * Scope:
 *   apps/nacp-exams/lib/actions/*.ts
 *   apps/zonga/lib/actions/*.ts
 *   apps/cfo/lib/actions/*.ts
 *   apps/partners/lib/actions/*.ts
 *   apps/union-eyes/actions/*.ts
 *
 * Rules:
 *   - FAIL if a server action file ('use server') does not import resolveOrgContext
 *   - FAIL if a server action file uses bare auth() without resolveOrgContext
 *   - FAIL if any exception in governance/exceptions/org-required-server-actions.json is expired
 *   - PASS otherwise
 *
 * @invariant ORG_REQUIRED_SERVER_ACTIONS_001
 * @invariant NO_BARE_AUTH_IN_ACTIONS_001
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  ROOT,
  relPath,
  loadExceptions,
  isExcepted,
  formatViolations,
  type Violation,
} from './governance-helpers'

// ── Configuration ───────────────────────────────────────────────────────────

const ACTION_ROOTS = [
  join(ROOT, 'apps', 'nacp-exams', 'lib', 'actions'),
  join(ROOT, 'apps', 'zonga', 'lib', 'actions'),
  join(ROOT, 'apps', 'cfo', 'lib', 'actions'),
  join(ROOT, 'apps', 'partners', 'lib', 'actions'),
  join(ROOT, 'apps', 'union-eyes', 'actions'),
]

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function listActionFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('-actions.ts'))
    .map((f) => join(dir, f))
}

// ── ORG_REQUIRED_SERVER_ACTIONS_001 ─────────────────────────────────────────

describe('ORG_REQUIRED_SERVER_ACTIONS_001 — Server actions must use resolveOrgContext', () => {
  it('every "use server" action file imports resolveOrgContext', () => {
    const violations: Violation[] = []
    const exceptionFile = loadExceptions(
      'governance/exceptions/org-required-server-actions.json',
    )

    for (const root of ACTION_ROOTS) {
      for (const file of listActionFiles(root)) {
        const rel = relPath(file)
        if (isExcepted(rel, exceptionFile.entries)) continue

        const content = readSafe(file)
        if (!content.includes("'use server'")) continue

        if (!content.includes('resolveOrgContext')) {
          violations.push({
            ruleId: 'ORG_REQUIRED_SERVER_ACTIONS_001',
            filePath: rel,
            offendingValue: 'Missing resolveOrgContext import',
            remediation:
              "Import and call resolveOrgContext() from '@/lib/resolve-org' instead of using bare auth()",
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it('no expired exceptions for ORG_REQUIRED_SERVER_ACTIONS_001', () => {
    const exceptionFile = loadExceptions(
      'governance/exceptions/org-required-server-actions.json',
    )
    expect(
      exceptionFile.expiredEntries,
      `${exceptionFile.expiredEntries.length} expired exception(s)`,
    ).toHaveLength(0)
  })
})

// ── NO_BARE_AUTH_IN_ACTIONS_001 ─────────────────────────────────────────────

describe('NO_BARE_AUTH_IN_ACTIONS_001 — No bare auth() in migrated action files', () => {
  it('files with resolveOrgContext must not also import bare auth() from @clerk/nextjs', () => {
    const violations: Violation[] = []

    for (const root of ACTION_ROOTS) {
      for (const file of listActionFiles(root)) {
        const rel = relPath(file)
        const content = readSafe(file)

        // Only check files that are already migrated to resolveOrgContext
        if (!content.includes('resolveOrgContext')) continue

        if (
          content.includes("from '@clerk/nextjs/server'") &&
          content.includes('auth()')
        ) {
          violations.push({
            ruleId: 'NO_BARE_AUTH_IN_ACTIONS_001',
            filePath: rel,
            offendingValue: "Imports auth() from '@clerk/nextjs/server' alongside resolveOrgContext",
            remediation:
              'Remove bare auth() import; resolveOrgContext already wraps auth() internally',
          })
        }
      }
    }

    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})
