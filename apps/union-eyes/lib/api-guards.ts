// cspell:words nzila
/**
 * Union Eyes app API guards — authentication + audited database access.
 *
 * Provides the standard withAudit / createAuditedScopedDb wrappers
 * so case-management API routes use audited, Org-isolated writes.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  withAudit,
  createAuditedScopedDb,
  createScopedDb,
  type AuditedScopedDb,
} from '@nzila/db'

// ── Re-exports for route convenience ────────────────────────────────────────
export { withAudit, createAuditedScopedDb }
export type { AuditedScopedDb }

/**
 * Authenticate the current request via Clerk.
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
 * Combines Clerk auth with createAuditedScopedDb so routes get a
 * write-enabled, auto-auditing DB in one call.
 */
export async function getAuditedDb(entityId: string): Promise<
  | { ok: true; db: AuditedScopedDb; userId: string }
  | { ok: false; response: NextResponse }
> {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult

  const db = createAuditedScopedDb({
    orgId: entityId,
    actorId: authResult.userId,
  })

  return { ok: true, db, userId: authResult.userId }
}

/**
 * Create a read-only, Org-scoped database for the given entity.
 */
export function getReadOnlyDb(entityId: string) {
  return createScopedDb({ orgId: entityId })
}
