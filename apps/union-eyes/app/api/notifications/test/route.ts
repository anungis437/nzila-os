/**
 * POST /api/notifications/test
 * Stores one in-app test notification for the authenticated user. Steward-only.
 * It exercises the in-app inbox only and says so: no push, e-mail or SMS channel is called, and the response reports each channel's
 * actual state. A recent unread test row is reused and a new one expires in an hour, so repeated calls do not accumulate rows.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inAppNotifications } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Send a test notification',
      description: 'Creates a test in-app notification for the current user. Steward-only.',
    },
  },
  async ({ userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    return withRLSContext({ organizationId }, async (tx) => {
      const delivery = { inApp: 'stored', push: 'not_attempted', email: 'not_attempted', sms: 'not_attempted' } as const;
      const [recent] = await tx
        .select()
        .from(inAppNotifications)
        .where(and(
          eq(inAppNotifications.userId, userId),
          eq(inAppNotifications.organizationId, organizationId),
          eq(inAppNotifications.read, false),
          sql`(${inAppNotifications.data} ->> 'kind') = 'notification-test'`,
          gte(inAppNotifications.expiresAt, new Date()),
        ))
        .limit(1);
      if (recent) return { notification: recent, delivery, reused: true };

      const [notification] = await tx
        .insert(inAppNotifications)
        .values({
          userId,
          organizationId,
          title: 'Test Notification',
          message: 'This confirms that in-app notifications are stored for your account. It does not test push, e-mail or SMS delivery.',
          type: 'info',
          actionLabel: 'Dismiss',
          data: { kind: 'notification-test' },
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'notification.test_create',
        resourceType: 'in_app_notifications',
        resourceId: notification.id,
        details: {},
      });
      return { notification, delivery, reused: false };
    });
  },
);

