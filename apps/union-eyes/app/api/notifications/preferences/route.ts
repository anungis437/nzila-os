/**
 * GET PUT /api/notifications/preferences
 * Notification preferences for the authenticated user.
 * Backed by userNotificationPreferences table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { userNotificationPreferences } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Get notification preferences',
      description: 'Returns notification preferences for the current user.',
    },
  },
  async ({ userId, organizationId }) => {
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
      return {
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        digestFrequency: 'daily',
        quietHoursStart: null,
        quietHoursEnd: null,
        claimUpdates: true,
        documentUpdates: true,
        deadlineAlerts: true,
        systemAnnouncements: true,
        securityAlerts: true,
      };
    }

    return prefs;
  },
);

export const PUT = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: 'Update notification preferences',
      description: 'Creates or updates notification preferences for the current user.',
    },
  },
  async ({ body, userId, organizationId }) => {
    const {
      email,
      phone,
      emailEnabled,
      smsEnabled,
      pushEnabled,
      inAppEnabled,
      digestFrequency,
      quietHoursStart,
      quietHoursEnd,
      claimUpdates,
      documentUpdates,
      deadlineAlerts,
      systemAnnouncements,
      securityAlerts,
    } = body as Record<string, unknown>;

    const [existing] = await db
      .select()
      .from(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.userId, userId!),
          eq(userNotificationPreferences.organizationId, organizationId!),
        ),
      )
      .limit(1);

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (emailEnabled !== undefined) data.emailEnabled = emailEnabled;
    if (smsEnabled !== undefined) data.smsEnabled = smsEnabled;
    if (pushEnabled !== undefined) data.pushEnabled = pushEnabled;
    if (inAppEnabled !== undefined) data.inAppEnabled = inAppEnabled;
    if (digestFrequency !== undefined) data.digestFrequency = digestFrequency;
    if (quietHoursStart !== undefined) data.quietHoursStart = quietHoursStart;
    if (quietHoursEnd !== undefined) data.quietHoursEnd = quietHoursEnd;
    if (claimUpdates !== undefined) data.claimUpdates = claimUpdates;
    if (documentUpdates !== undefined) data.documentUpdates = documentUpdates;
    if (deadlineAlerts !== undefined) data.deadlineAlerts = deadlineAlerts;
    if (systemAnnouncements !== undefined) data.systemAnnouncements = systemAnnouncements;
    if (securityAlerts !== undefined) data.securityAlerts = securityAlerts;

    if (existing) {
      const [updated] = await db
        .update(userNotificationPreferences)
        .set(data)
        .where(eq(userNotificationPreferences.id, existing.id))
        .returning();
      return updated;
    }

    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required for new preferences' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [created] = await db
      .insert(userNotificationPreferences)
      .values({
        userId: userId!,
        organizationId: organizationId!,
        email: email as string,
        ...(data as Record<string, unknown>),
      })
      .returning();

    return created;
  },
);

