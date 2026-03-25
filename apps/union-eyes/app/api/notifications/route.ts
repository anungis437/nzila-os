/**
 * GET POST /api/notifications
 * In-app notifications — list and create.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { inAppNotifications } from '@/db/schema';
import { eq, and, desc, count, isNull, or, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'List in-app notifications',
      description: 'Returns paginated in-app notifications for the authenticated user.',
    },
  },
  async ({ request, userId, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    try {
      const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
      const type = url.searchParams.get('type');
      const offset = (page - 1) * limit;

      const now = new Date();
      const conditions = [
        eq(inAppNotifications.userId, userId!),
        eq(inAppNotifications.organizationId, organizationId!),
        or(isNull(inAppNotifications.expiresAt), gte(inAppNotifications.expiresAt, now)),
      ];

      if (unreadOnly) {
        conditions.push(eq(inAppNotifications.read, false));
      }
      if (type) {
        conditions.push(eq(inAppNotifications.type, type));
      }

      const whereClause = and(...conditions);

      const [totalResult, notifications, unreadResult] = await Promise.all([
        db.select({ total: count() }).from(inAppNotifications).where(whereClause),
        db
          .select()
          .from(inAppNotifications)
          .where(whereClause)
          .orderBy(desc(inAppNotifications.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(inAppNotifications)
          .where(
            and(
              eq(inAppNotifications.userId, userId!),
              eq(inAppNotifications.organizationId, organizationId!),
              eq(inAppNotifications.read, false),
              or(isNull(inAppNotifications.expiresAt), gte(inAppNotifications.expiresAt, now)),
            ),
          ),
      ]);

      const total = totalResult[0]?.total ?? 0;
      const unreadCount = unreadResult[0]?.total ?? 0;

      return {
        notifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      const { logger: log } = await import('@/lib/logger');
      log.error('Notifications query failed', { error: error instanceof Error ? error.message : 'Unknown' });
      // in_app_notifications table may lack expected columns
      return {
        notifications: [],
        unreadCount: 0,
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Create an in-app notification',
      description: 'Creates a new in-app notification for a specific user.',
    },
  },
  async ({ body, organizationId }) => {
    const { userId: targetUserId, title, message, type, actionLabel, actionUrl, data, expiresAt } =
      body as {
        userId: string;
        title: string;
        message: string;
        type?: string;
        actionLabel?: string;
        actionUrl?: string;
        data?: Record<string, unknown>;
        expiresAt?: string;
      };

    if (!targetUserId || !title || !message) {
      throw ApiError.badRequest('userId, title, and message are required');
    }

    const [notification] = await db
      .insert(inAppNotifications)
      .values({
        userId: targetUserId,
        organizationId: organizationId!,
        title,
        message,
        type: type || 'info',
        actionLabel,
        actionUrl,
        data,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      })
      .returning();

    return notification;
  },
);

