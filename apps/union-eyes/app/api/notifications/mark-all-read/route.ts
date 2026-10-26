/**
 * POST /api/notifications/mark-all-read
 * Marks all unread notifications as read for the authenticated user.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inAppNotifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      description: 'Marks all unread in-app notifications as read for the current user.',
    },
  },
  async ({ userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    return withRLSContext({ organizationId }, async (tx) => {
      const updated = await tx
        .update(inAppNotifications)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(inAppNotifications.userId, userId),
            eq(inAppNotifications.organizationId, organizationId),
            eq(inAppNotifications.read, false),
          ),
        )
        .returning({ id: inAppNotifications.id });

      if (updated.length > 0) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'notification.mark_all_read',
          resourceType: 'in_app_notifications',
          resourceId: userId,
          details: { count: updated.length },
        });
      }
      return { success: true, updated: updated.length };
    });
  },
);

