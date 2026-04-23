/**
 * User lifecycle management — active, suspended, deprovisioned.
 *
 * This is the foundation for later SCIM support: every identity-lifecycle
 * action in the platform goes through these functions, and they all write
 * to `auth_audit_log`. When SCIM endpoints are added, they call the exact
 * same functions.
 *
 * Semantics:
 *   active        → normal; login allowed.
 *   suspended     → login refused with generic "account disabled" error;
 *                   existing sessions are NOT revoked automatically — call
 *                   `revokeAllUserSessions` separately if you need that.
 *   deprovisioned → final state; login refused; active sessions revoked.
 *                   Irreversible via this API (requires direct DB to reactivate).
 *
 * `accountSource` is an audit trail of where the user came from originally;
 * it never changes, even if the user later uses a different auth method.
 */
import { db } from '@nzila/db/client'
import { authUsers, authAuditLog, authUserSessions } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'

export type LifecycleState = 'active' | 'suspended' | 'deprovisioned'
export type AccountSource = 'local' | 'sso' | 'invite' | 'scim'

async function logEvent(
  eventType: string,
  opts: {
    userId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await db.insert(authAuditLog).values({
      userId: opts.userId ?? null,
      eventType,
      metadata: opts.metadata ?? {},
    })
  } catch {
    // best-effort
  }
}

export async function suspendUser(
  userId: string,
  actorUserId: string,
  reason?: string,
): Promise<{ success: boolean }> {
  await db
    .update(authUsers)
    .set({
      lifecycleState: 'suspended',
      lifecycleReason: reason ?? null,
      lifecycleChangedAt: new Date(),
      lifecycleChangedBy: actorUserId,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.userId, userId))
  await logEvent('user_suspended', {
    userId,
    metadata: { actorUserId, reason: reason ?? null },
  })
  return { success: true }
}

export async function reactivateUser(
  userId: string,
  actorUserId: string,
): Promise<{ success: boolean }> {
  await db
    .update(authUsers)
    .set({
      lifecycleState: 'active',
      lifecycleReason: null,
      lifecycleChangedAt: new Date(),
      lifecycleChangedBy: actorUserId,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.userId, userId))
  await logEvent('user_reactivated', { userId, metadata: { actorUserId } })
  return { success: true }
}

export async function deprovisionUser(
  userId: string,
  actorUserId: string,
  reason?: string,
): Promise<{ success: boolean; sessionsRevoked: number }> {
  await db
    .update(authUsers)
    .set({
      lifecycleState: 'deprovisioned',
      lifecycleReason: reason ?? null,
      lifecycleChangedAt: new Date(),
      lifecycleChangedBy: actorUserId,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.userId, userId))

  // Revoke all active sessions
  const revoked = await db
    .update(authUserSessions)
    .set({ isActive: false })
    .where(
      and(
        eq(authUserSessions.userId, userId),
        eq(authUserSessions.isActive, true),
      ),
    )
    .returning({ id: authUserSessions.sessionId })

  await logEvent('user_deprovisioned', {
    userId,
    metadata: {
      actorUserId,
      reason: reason ?? null,
      sessionsRevoked: revoked.length,
    },
  })
  return { success: true, sessionsRevoked: revoked.length }
}

export async function getUserLifecycle(userId: string): Promise<{
  lifecycleState: LifecycleState
  accountSource: AccountSource
  lifecycleReason: string | null
  lifecycleChangedAt: Date | null
} | null> {
  const [row] = await db
    .select({
      lifecycleState: authUsers.lifecycleState,
      accountSource: authUsers.accountSource,
      lifecycleReason: authUsers.lifecycleReason,
      lifecycleChangedAt: authUsers.lifecycleChangedAt,
    })
    .from(authUsers)
    .where(eq(authUsers.userId, userId))
    .limit(1)
  if (!row) return null
  return {
    lifecycleState: row.lifecycleState as LifecycleState,
    accountSource: row.accountSource as AccountSource,
    lifecycleReason: row.lifecycleReason,
    lifecycleChangedAt: row.lifecycleChangedAt,
  }
}
