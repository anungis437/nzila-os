/**
 * POST /api/notifications/mark-all-read
 * Marks all unread notifications as read for the authenticated user.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
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
    await db
      .update(inAppNotifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(inAppNotifications.userId, userId!),
          eq(inAppNotifications.organizationId, organizationId!),
          eq(inAppNotifications.read, false),
        ),
      );

    return { success: true };
  },
);

