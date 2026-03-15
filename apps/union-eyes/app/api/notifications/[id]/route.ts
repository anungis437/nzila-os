/**
 * GET PATCH DELETE /api/notifications/[id]
 * Single notification operations — read, mark-as-read, delete.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { inAppNotifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Get a single notification',
      description: 'Returns a single in-app notification by ID.',
    },
  },
  async ({ request, userId }, _req?: unknown, routeParams?: Params) => {
    const { id } = await routeParams!.params;

    const [notification] = await db
      .select()
      .from(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId!)))
      .limit(1);

    if (!notification) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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
  async ({ body, userId }, _req?: unknown, routeParams?: Params) => {
    const { id } = await routeParams!.params;
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
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
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
  async ({ userId }, _req?: unknown, routeParams?: Params) => {
    const { id } = await routeParams!.params;

    const [deleted] = await db
      .delete(inAppNotifications)
      .where(and(eq(inAppNotifications.id, id), eq(inAppNotifications.userId, userId!)))
      .returning();

    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Notification not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return { success: true };
  },
);


