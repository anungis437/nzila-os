/**
 * Ratchets for the session-bearer-in-PostgreSQL-setting exposure (UE-CONV-A-004). Source-level only: they prove what the
 * repository does, not what any live PostgreSQL instance logs (log_parameter_max_length, log_statement and slow-statement
 * logging remain an unverified OPERATIONS gate; see UE-SESSION-BEARER-EXPOSURE-REVIEW.md section 4.1).
 *
 *   1. The set of source files that touch `app.current_session_token` is the allowlist below. A second consumer fails here.
 *   2. The binding statement helper has one runtime consumer, and it sanitizes failures (Drizzle copies a failed
 *      statement's parameters into its error message).
 *   3. No production Drizzle client enables a query logger (which would print bind parameters).
 *   4. Django SQL logging is off by default and no `django.db.backends` logger is configured.
 *
 * Files are found with `git grep --untracked` so a new, not-yet-committed consumer is caught too.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..', '..', '..', '..', '..')
const NOT_TESTS = [':(exclude)**/*.test.*', ':(exclude)**/*.spec.*', ':(exclude)**/__tests__/**', ':(exclude)**/tests_*.py', ':(exclude)**/test_*.py']

function filesMatching(pattern: string, paths: readonly string[]): string[] {
  try {
    const out = execFileSync('git', ['grep', '--untracked', '-l', '-F', '-e', pattern, '--', ...paths, ...NOT_TESTS], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    return out.split('\n').filter(Boolean).sort()
  } catch (error) {
    if ((error as { status?: number }).status === 1) return []
    throw error
  }
}
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const CODE_GLOBS = (dirs: readonly string[]) => dirs.flatMap((d) => ['ts', 'tsx', 'py', 'sql', 'mjs', 'js'].map((e) => `${d}/*.${e}`))

describe('UE-CONV-A-004 source ratchets', () => {
  it('only the reviewed files reference app.current_session_token', () => {
    const files = filesMatching('app.current_session_token', CODE_GLOBS(['apps/union-eyes', 'packages/db/src', 'packages/platform-auth/src']))
    expect(files).toEqual(
      [
        'apps/union-eyes/backend/auth_core/canonical_context.py',
        'apps/union-eyes/db/migrations-cache/0017_snapshot_authority_reconciliation.sql',
        'apps/union-eyes/lib/authority/store/executor.ts',
        'apps/union-eyes/scripts/bootstrap-v2/auth-org-runtime.ts',
        'apps/union-eyes/scripts/bootstrap-v2/framework-runtime.ts',
        'apps/union-eyes/scripts/bootstrap-v2/framework-sql.ts',
        'apps/union-eyes/scripts/bootstrap-v2/framework_application.py',
        'apps/union-eyes/scripts/bootstrap-v2/runtime-security.ts',
        'packages/db/src/auth-storage-authority/org-session-authority.ts',
        'packages/platform-auth/src/org-binding.ts',
      ].sort(),
    )
  })

  it('the binding statement has one runtime consumer, and it routes failures through the sanitizer', () => {
    const consumers = filesMatching('authenticatedOrgBindingSql', CODE_GLOBS(['apps/union-eyes/lib', 'apps/union-eyes/app', 'apps/union-eyes/services', 'apps/union-eyes/db']))
    expect(consumers).toEqual(['apps/union-eyes/lib/db/with-rls-context.ts'])
    expect(read('apps/union-eyes/lib/db/with-rls-context.ts')).toMatch(
      /try\s*\{\s*await tx\.execute\(authenticatedOrgBindingSql\(binding\)\)\s*\}\s*catch \(error\)\s*\{\s*throw sanitizedBindingError\(error\)/,
    )
  })

  it('the kernel executor receives the bearer only from a verified binding', () => {
    const callers = filesMatching('sessionToken: binding.sessionToken', CODE_GLOBS(['apps/union-eyes/lib', 'apps/union-eyes/app', 'apps/union-eyes/services']))
    expect(callers).toEqual(['apps/union-eyes/lib/authority/store/platform-identity.ts'])
  })

  it('the long-lived cookie is never handed to the session-setting writer', () => {
    const binder = read('packages/platform-auth/src/org-binding.ts')
    expect(binder).toMatch(/sessionToken: token,/)
    expect(binder).not.toMatch(/sessionToken:\s*cookie\b/)
    expect(binder).toMatch(/expiresAt: sql`statement_timestamp\(\)\+interval '30 seconds'`/)
  })

  it('no production Drizzle client enables a query logger (it would print bind parameters)', () => {
    const clients = filesMatching('drizzle(', CODE_GLOBS(['packages/db/src', 'packages/platform-auth/src', 'apps/union-eyes/db', 'apps/union-eyes/lib', 'apps/union-eyes/services']))
    expect(clients.length).toBeGreaterThan(0)
    expect(clients.filter((file) => /drizzle\([^;]*\blogger\s*:/s.test(read(file)))).toEqual([])
  })

  it('Django SQL logging is off by default and no database-backend logger is configured', () => {
    const settings = read('apps/union-eyes/backend/config/settings.py')
    expect(settings).toMatch(/DEBUG = os\.environ\.get\("DJANGO_DEBUG", "False"\)/)
    expect(settings).not.toMatch(/["']django\.db\.backends["']\s*:/)
  })
})
