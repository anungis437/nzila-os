/**
 * GET PATCH DELETE /api/notifications/[id]
 * Single notification operations — read, mark-as-read, delete.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { inAppNotifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Get a single notification',
      description: 'Returns a single in-app notification by ID.',
    },
  },
  async ({ params, userId }) => {
    const { id } = await params;

    const [notification] = await db
      .select()
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId!)))
      .limit(1);

    if (!notification) {
      throw ApiError.notFound('Notification');
    }

    return notification;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Update a notification (mark as read)',
      description: 'Updates a notification, typically to mark it as read.',
    },
  },
  async ({ params, body, userId }) => {
    const { id } = await params;
    const { read } = (body as { read?: boolean }) || {};

    const updateData: Record<string, unknown> = {};
    if (read !== undefined) {
      updateData.read = read;
      if (read) {
        updateData.readAt = new Date();
      }
    }

    const [updated] = await db
      .update(inAppNotifications)
      .set(updateData)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId!)))
      .returning();

    if (!updated) {
      throw ApiError.notFound('Notification');
    }

    return updated;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Delete a notification',
      description: 'Deletes a single in-app notification.',
    },
  },
  async ({ params, userId }) => {
    const { id } = await params;

    const [deleted] = await db
      .delete(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId!)))
      .returning();

    if (!deleted) {
      throw ApiError.notFound('Notification');
    }

    return { success: true };
  },
);


