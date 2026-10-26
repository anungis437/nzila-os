/**
 * POST /api/notifications/test
 * Creates a test notification for the authenticated user. Steward-only.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inAppNotifications } from '@/db/schema';

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
      const [notification] = await tx
        .insert(inAppNotifications)
        .values({
          userId,
          organizationId,
          title: 'Test Notification',
          message: 'This is a test notification to verify your notification setup is working correctly.',
          type: 'info',
          actionLabel: 'Dismiss',
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
      return notification;
    });
  },
);

