/**
 * GET PATCH DELETE /api/notifications/[id]
 * Single notification operations — read, mark-as-read, delete.
 * Backed by inAppNotifications table (Drizzle ORM).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { inAppNotifications } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

// Only a real boolean is accepted: a truthy string used to set the read time and store text in the boolean column.
const patchSchema = z.object({ read: z.boolean() }).strict();

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
  async ({ params, body, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('read must be true or false');
    const { read } = parsed.data;

    // The read time always agrees with the flag: marking unread clears it.
    const updateData: Record<string, unknown> = { read, readAt: read ? new Date() : null };

    return withRLSContext({ organizationId }, async (tx) => {
      const [updated] = await tx
        .update(inAppNotifications)
        .set(updateData)
        .where(
          and(
            eq(inAppNotifications.id, id),
            eq(inAppNotifications.userId, userId),
            eq(inAppNotifications.organizationId, organizationId),
          ),
        )
        .returning();

      if (!updated) {
        throw ApiError.notFound('Notification');
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'notification.update',
        resourceType: 'in_app_notifications',
        resourceId: id,
        details: { read },
      });
      return updated;
    });
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
  async ({ params, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const { id } = await params;

    return withRLSContext({ organizationId }, async (tx) => {
      const [deleted] = await tx
        .delete(inAppNotifications)
        .where(
          and(
            eq(inAppNotifications.id, id),
            eq(inAppNotifications.userId, userId),
            eq(inAppNotifications.organizationId, organizationId),
          ),
        )
        .returning({ id: inAppNotifications.id });

      if (!deleted) {
        throw ApiError.notFound('Notification');
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'notification.delete',
        resourceType: 'in_app_notifications',
        resourceId: id,
        details: {},
      });
      return { success: true };
    });
  },
);


