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
import { authDb as db, withAuthContext, withAuthenticatedAuthContext, withAuthSavepoint } from '../auth-db'
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
    await withAuthSavepoint(async () => db.insert(authAuditLog).values({
      userId: opts.userId ?? null,
      eventType,
      metadata: opts.metadata ?? {},
    }))
  } catch {
    // best-effort
  }
}

export async function suspendUser(
  userId: string,
  actorUserId: string,
  reason?: string,
): Promise<{ success: boolean }> {
  await validateActor(actorUserId)
  return withAuthContext({ phase: 'lifecycle', operation: 'suspend', actorUserId, targetUserId: userId, reason: reason ?? 'Explicit user suspension' },
    () => suspendWithContext(userId, actorUserId, reason))
}

async function validateActor(actorUserId: string): Promise<void> {
  const { auth } = await import('../entra/server')
  if ((await auth()).userId !== actorUserId) throw new Error('Authenticated lifecycle administrator required')
}

async function suspendWithContext(userId: string, actorUserId: string, reason?: string): Promise<{ success: boolean }> {
  const changed = await db
    .update(authUsers)
    .set({
      lifecycleState: 'suspended',
      lifecycleReason: reason ?? null,
      lifecycleChangedAt: new Date(),
      lifecycleChangedBy: actorUserId,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.userId, userId)).returning({ userId: authUsers.userId })
  if (!changed.length) return { success: false }
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
  await validateActor(actorUserId)
  return withAuthContext({ phase: 'lifecycle', operation: 'reactivate', actorUserId, targetUserId: userId, reason: 'Explicit user reactivation' },
    () => reactivateWithContext(userId, actorUserId))
}

async function reactivateWithContext(userId: string, actorUserId: string): Promise<{ success: boolean }> {
  const changed = await db
    .update(authUsers)
    .set({
      lifecycleState: 'active',
      lifecycleReason: null,
      lifecycleChangedAt: new Date(),
      lifecycleChangedBy: actorUserId,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.userId, userId)).returning({ userId: authUsers.userId })
  if (!changed.length) return { success: false }
  await logEvent('user_reactivated', { userId, metadata: { actorUserId } })
  return { success: true }
}

export async function deprovisionUser(
  userId: string,
  actorUserId: string,
  reason?: string,
): Promise<{ success: boolean; sessionsRevoked: number }> {
  await validateActor(actorUserId)
  return withAuthContext({ phase: 'lifecycle', operation: 'deprovision', actorUserId, targetUserId: userId, reason: reason ?? 'Explicit user deprovisioning' },
    () => deprovisionWithContext(userId, actorUserId, reason))
}

async function deprovisionWithContext(userId: string, actorUserId: string, reason?: string): Promise<{ success: boolean; sessionsRevoked: number }> {
  const changed = await db
    .update(authUsers)
    .set({
      lifecycleState: 'deprovisioned',
      lifecycleReason: reason ?? null,
      lifecycleChangedAt: new Date(),
      lifecycleChangedBy: actorUserId,
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(authUsers.userId, userId)).returning({ userId: authUsers.userId })
  if (!changed.length) return { success: false, sessionsRevoked: 0 }

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
  return withAuthenticatedAuthContext(userId, () => getLifecycleWithContext(userId))
}

async function getLifecycleWithContext(userId: string) {
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
