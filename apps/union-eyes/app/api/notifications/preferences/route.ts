/**
 * GET PUT /api/notifications/preferences
 * The authenticated user's own notification preferences (user_notification_preferences; RLS is
 * user- and organization-scoped). Writes are validated: unknown fields are rejected.
 */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { userNotificationPreferences } from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const DEFAULT_PREFERENCES = {
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
} as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable();

const updateSchema = z
  .object({
    email: z.string().email().max(320),
    phone: z.string().max(40).nullable(),
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    inAppEnabled: z.boolean(),
    digestFrequency: z.enum(['immediate', 'daily', 'weekly', 'never']),
    quietHoursStart: hhmm,
    quietHoursEnd: hhmm,
    claimUpdates: z.boolean(),
    documentUpdates: z.boolean(),
    deadlineAlerts: z.boolean(),
    systemAnnouncements: z.boolean(),
    securityAlerts: z.boolean(),
  })
  .partial()
  .strict();

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Notifications'], summary: 'Get notification preferences', description: 'Returns notification preferences for the current user; defaults are returned (not stored) until first saved.' },
  },
  async ({ userId, organizationId }) => {
    const [prefs] = await withRLSContext(async (tx) =>
      tx
        .select()
        .from(userNotificationPreferences)
        .where(and(eq(userNotificationPreferences.userId, userId!), eq(userNotificationPreferences.organizationId, organizationId!)))
        .limit(1),
    );
    return prefs ? { ...prefs, saved: true } : { ...DEFAULT_PREFERENCES, saved: false };
  },
);

export const PUT = withApi(
  {
    auth: { required: true, minRole: 'member' },
    body: updateSchema,
    openapi: { tags: ['Notifications'], summary: 'Update notification preferences', description: 'Creates or updates notification preferences for the current user.' },
  },
  async ({ body, user, userId, organizationId }) => {
    const values = { ...body, updatedAt: new Date() };
    // The preference change and its audit record commit together.
    const saved = await withRLSContext(async (tx) => {
      const auditPreferences = (handle: typeof tx, id: string) =>
        persistAtomicAudit(handle, {
          userId: userId!,
          organizationId: organizationId!,
          resourceType: 'user_notification_preferences',
          resourceId: id,
          action: 'notification_preferences.update',
          details: { fields: Object.keys(body) },
        });
      const [existing] = await tx
        .select({ id: userNotificationPreferences.id })
        .from(userNotificationPreferences)
        .where(and(eq(userNotificationPreferences.userId, userId!), eq(userNotificationPreferences.organizationId, organizationId!)))
        .limit(1);
      if (existing) {
        const [updated] = await tx.update(userNotificationPreferences).set(values).where(eq(userNotificationPreferences.id, existing.id)).returning();
        await auditPreferences(tx, updated.id);
        return updated;
      }
      const email = body.email ?? user?.email;
      if (!email) throw ApiError.badRequest('email is required for new preferences');
      const [created] = await tx
        .insert(userNotificationPreferences)
        .values({ ...values, email, userId: userId!, organizationId: organizationId! })
        .returning();
      await auditPreferences(tx, created.id);
      return created;
    });
    return { ...saved, saved: true };
  },
);
