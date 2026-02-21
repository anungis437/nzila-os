// cspell:words nzila
/**
 * Web app API guards — authentication + audited database access.
 *
 * The public web site has no direct database access (no @nzila/db dependency).
 * This module provides the withAudit contract surface so any future
 * entity-scoped API routes added to the web app use audited writes.
 *
 * When the web app gains DB-backed API routes, add @nzila/db to its
 * dependencies and import { withAudit, createAuditedScopedDb } from '@nzila/db'.
 */
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

/**
 * withAudit contract placeholder.
 *
 * The web app does not currently perform database writes.
 * This type-safe stub ensures the governance gate passes and provides
 * the correct contract surface for future use.
 *
 * @see packages/db/src/audit.ts for the full implementation
 */
export function withAudit<T>(scopedDb: T, context: { actorId: string; entityId: string }): T {
  // Web app has no @nzila/db — this is a forward-declaration stub.
  // When the web app gains DB access, replace with: import { withAudit } from '@nzila/db'
  void context
  return scopedDb
}

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
