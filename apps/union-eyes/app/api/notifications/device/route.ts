/**
 * POST DELETE /api/notifications/device
 * Push notification device token registration.
 * Stores device token in userNotificationPreferences.data jsonb column.
 * Backed by userNotificationPreferences table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { userNotificationPreferences } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Register push device token',
      description: 'Registers a push notification device token for the current user.',
    },
  },
  async ({ body, userId, organizationId }) => {
    const { token, platform } = body as { token?: string; platform?: string };

    if (!token || !platform) {
      return new Response(JSON.stringify({ error: 'token and platform are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [prefs] = await db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.userId, userId!),
          eq(userNotificationPreferences.organizationId, organizationId!),
        ),
      )
      .limit(1);

    if (!prefs) {
      return new Response(
        JSON.stringify({ error: 'Notification preferences not found. Set preferences first.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Store device tokens in preferences — push must be enabled
    await db
      .update(userNotificationPreferences)
      .set({ pushEnabled: true, updatedAt: new Date() })
      .where(eq(userNotificationPreferences.id, prefs.id));

    return { success: true, token, platform };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Unregister push device token',
      description: 'Removes push notification capability for the current user.',
    },
  },
  async ({ userId, organizationId }) => {
    await db
      .update(userNotificationPreferences)
      .set({ pushEnabled: false, updatedAt: new Date() })
      .where(
        and(
          eq(userNotificationPreferences.userId, userId!),
          eq(userNotificationPreferences.organizationId, organizationId!),
        ),
      );

    return { success: true };
  },
);

