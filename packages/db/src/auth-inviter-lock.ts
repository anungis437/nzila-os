import { sql } from 'drizzle-orm'
import type { AuthExecutionContext } from './auth-storage-authority/execution-boundary'

/**
 * Transaction-scoped lock shared by invitation redemption and the writes that
 * end an inviter's authority. `auth_invite_inviter_live()` is re-checked on
 * every statement, but a statement that already passed is not re-checked at
 * COMMIT. Holding this lock until commit makes a lifecycle or membership
 * write wait, and a redemption that acquires it afterwards sees the committed
 * denial. No table grant is added.
 */
export function inviterAuthorityLockKey(userId: string): string {
  return `auth-inviter:${userId}`
}

/** Session revocation does not change the facts the inviter predicate reads. */
export function inviterAuthorityLockUserId(context: AuthExecutionContext): string | null {
  if (context.phase === 'lifecycle') return context.targetUserId
  if (context.phase === 'system' && context.operation === 'membership-state') return context.targetUserId
  return null
}

export async function lockInviterAuthority(
  executor: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  userId: string,
): Promise<void> {
  if (!userId.trim()) throw new Error('Inviter authority lock requires a user id')
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${inviterAuthorityLockKey(userId)}, 0))`)
}
