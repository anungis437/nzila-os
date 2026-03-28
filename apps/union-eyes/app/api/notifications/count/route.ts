/**
 * GET /api/notifications/count
 * Returns unread notification count for the authenticated user.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { inAppNotifications } from '@/db/schema';
import { eq, and, count, isNull, or, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Get unread notification count',
      description: 'Returns the number of unread in-app notifications for the current user.',
    },
  },
  async ({ userId, organizationId }) => {
    try {
      const now = new Date();
      const [result] = await db
        .select({ count: count() })
        .from(inAppNotifications)
        .where(
          and(
            eq(inAppNotifications.userId, userId!),
            eq(inAppNotifications.organizationId, organizationId!),
            eq(inAppNotifications.read, false),
            or(isNull(inAppNotifications.expiresAt), gte(inAppNotifications.expiresAt, now)),
          ),
        );

      return { count: result?.count ?? 0 };
    } catch {
      return { count: 0 };
    }
  },
);

