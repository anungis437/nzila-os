/**
 * POST /api/notifications/test
 * Creates a test notification for the authenticated user. Steward-only.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
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
    const [notification] = await db
      .insert(inAppNotifications)
      .values({
        userId: userId!,
        organizationId: organizationId!,
        title: 'Test Notification',
        message: 'This is a test notification to verify your notification setup is working correctly.',
        type: 'info',
        actionLabel: 'Dismiss',
      })
      .returning();

    return notification;
  },
);

