/**
 * Durable, tenant-bound education reminder delivery claims.
 * The deployed 20261103 unique index on (organization_id, user_id, data->>'dedupeKey')
 * arbitrates simultaneous cron runs. Claims are also visible in the member's inbox.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { inAppNotifications } from '@/db/schema/domains/communications/notifications';

export interface EducationReminderIdentity {
  organizationId: string;
  userId: string;
  sourceId: string;
  kind: 'session' | 'certification';
  leadDays: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function educationReminderKey(identity: EducationReminderIdentity): string {
  if (!UUID.test(identity.organizationId) || !UUID.test(identity.sourceId) ||
      !identity.userId.trim() || identity.userId.length > 256 ||
      (identity.kind === 'session' && ![7, 3, 1].includes(identity.leadDays)) ||
      (identity.kind === 'certification' && ![90, 30].includes(identity.leadDays)) ||
      !['session', 'certification'].includes(identity.kind)) {
    throw new Error('Invalid education reminder identity');
  }
  return `education:${identity.kind}:${identity.sourceId}:${identity.leadDays}`;
}

export async function claimEducationReminder(identity: EducationReminderIdentity): Promise<boolean> {
  const dedupeKey = educationReminderKey(identity);
  const inserted = await db.insert(inAppNotifications).values({
    organizationId: identity.organizationId,
    userId: identity.userId,
    title: identity.kind === 'session' ? 'Upcoming training session' : 'Certification expiry reminder',
    message: identity.kind === 'session'
      ? `A registered training session is ${identity.leadDays} day(s) away.`
      : `A certification expires in ${identity.leadDays} days.`,
    type: 'info',
    data: { dedupeKey, kind: 'education_reminder', reminderType: identity.kind, leadDays: identity.leadDays },
  }).onConflictDoNothing().returning({ id: inAppNotifications.id });
  return inserted.length === 1;
}

export async function releaseEducationReminder(identity: EducationReminderIdentity): Promise<void> {
  const dedupeKey = educationReminderKey(identity);
  await db.delete(inAppNotifications).where(and(
    eq(inAppNotifications.organizationId, identity.organizationId),
    eq(inAppNotifications.userId, identity.userId),
    sql`${inAppNotifications.data}->>'dedupeKey' = ${dedupeKey}`,
  ));
}
