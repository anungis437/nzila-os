// cspell:words nzila
/**
 * UnionEyes app API guards — authentication + audited database access.
 *
 * Provides the standard withAudit / createAuditedScopedDb wrappers
 * so case-management API routes use audited, Org-isolated writes.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  withAudit,
  createAuditedScopedDb,
  createScopedDb,
  type AuditedScopedDb,
} from '@nzila/db'
import { createRequestContext, runWithContext } from '@nzila/os-core'

// ── Re-exports for route convenience ────────────────────────────────────────
export { withAudit, createAuditedScopedDb }
export type { AuditedScopedDb }

/**
 * Authenticate the current request via platform auth.
 *
 * @returns userId or a 401 NextResponse error.
 */
export async function authenticateUser(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const { userId } = await auth()
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, userId }
}

/**
 * Create an audited, Org-scoped database for the given entity.
 *
 * Combines platform auth with createAuditedScopedDb so routes get a
 * write-enabled, auto-auditing DB in one call.
 */
export async function getAuditedDb(orgId: string): Promise<
  | { ok: true; db: AuditedScopedDb; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const db = createAuditedScopedDb({
    orgId: orgId,
    actorId: authResult.userId,
  })

  return { ok: true, db, userId: authResult.userId }
}

/**
 * Create a read-only, Org-scoped database for the given entity.
 */
export function getReadOnlyDb(orgId: string) {
  return createScopedDb({ orgId: orgId })
}

// ── Observability Helpers ────────────────────────────────────────────────────

/**
 * Wrap an API route handler with request context propagation.
 * Ensures OTel traces, structured logs, and audit trails share a
 * consistent request-scoped context.
 */
export async function withRequestContext<T>(
  request: Request | NextRequest,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = createRequestContext(request)
  return runWithContext(ctx, fn)
}
