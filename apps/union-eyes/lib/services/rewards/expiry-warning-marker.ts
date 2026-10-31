/**
 * The durable "already warned" record of a credit-expiry warning. The warning is also the member's in-app notice, and
 * in_app_notifications stores a notice carrying data.dedupeKey once per organization and member (unique index
 * uq_in_app_notifications_dedupe), so two runs on the same day, a retry or an overlapping cron mail a member once per
 * expiring lot and tier. A failed send releases the marker so the next run tries again.
 */
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { inAppNotifications } from '@/db/schema/domains/communications/notifications'

export interface ExpiryWarning {
  organizationId: string
  userId: string
  expiringAmount: number
  expirationDate: Date
  daysRemaining: number
}

export function expiryWarningKey(warning: Pick<ExpiryWarning, 'expirationDate'>, tierDays: number): string {
  return `rewards-expiry:${tierDays}:${warning.expirationDate.toISOString().slice(0, 10)}`
}

/** True when this run owns the warning; false when it was already recorded. */
export async function claimExpiryWarning(warning: ExpiryWarning, tierDays: number): Promise<boolean> {
  const rows = await db
    .insert(inAppNotifications)
    .values({
      organizationId: warning.organizationId,
      userId: warning.userId,
      title: 'Reward credits are about to expire',
      message: `${warning.expiringAmount} credits expire on ${warning.expirationDate.toISOString().slice(0, 10)}.`,
      type: 'warning',
      data: { dedupeKey: expiryWarningKey(warning, tierDays), kind: 'rewards_expiry_warning', tierDays },
    })
    .onConflictDoNothing()
    .returning({ id: inAppNotifications.id })
  return rows.length > 0
}

export async function releaseExpiryWarning(warning: ExpiryWarning, tierDays: number): Promise<void> {
  await db
    .delete(inAppNotifications)
    .where(
      and(
        eq(inAppNotifications.organizationId, warning.organizationId),
        eq(inAppNotifications.userId, warning.userId),
        sql`${inAppNotifications.data}->>'dedupeKey' = ${expiryWarningKey(warning, tierDays)}`,
      ),
    )
}
