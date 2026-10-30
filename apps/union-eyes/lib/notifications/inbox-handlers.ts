/**
 * In-app inbox handlers, shared by every path that serves the inbox (/api/notifications and /api/mobile/notifications).
 * They live here, not in a route file, so each path declares its own guard while the behaviour has one definition.
 */
import { ApiError, ErrorCode, type ApiContext } from '@/lib/api/framework';
import { db } from '@/db/db';
import { inAppNotifications, organizationMembers } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { eq, and, desc, count, isNull, or, gte, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// A steward-written notification is shown in the same inbox as a system one, so it carries its author in `data.origin` (the
// table has no sender column; any client-supplied origin is overwritten) and its size, target and link shape are bounded.
const STEWARD_NOTIFICATIONS_PER_HOUR = 100;
const createSchema = z.object({
  userId: z.string().min(1).max(255),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  type: z.enum(['info', 'success', 'warning', 'error']).optional(),
  actionLabel: z.string().trim().min(1).max(100).optional(),
  // A same-site path only: no scheme, no protocol-relative URL, so a link cannot carry a script or send a member off-site.
  actionUrl: z.string().max(500).regex(/^\/(?!\/)[^\s\\]*$/).optional(),
  data: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 4096, 'data is too large').optional(),
  expiresAt: z.string().datetime().refine((value) => new Date(value).getTime() > Date.now(), 'expiresAt must be in the future').optional(),
}).strict();

/** The inbox read, shared by every path that serves the in-app inbox. */
export const listNotifications = async ({ request, userId, organizationId }: ApiContext) => {
    const url = new URL(request.url);
    // A non-numeric page or limit is a bad request, not a query that fails and then reads as an empty inbox.
    const paging = listQuerySchema.safeParse({ page: url.searchParams.get('page') ?? undefined, limit: url.searchParams.get('limit') ?? undefined });
    if (!paging.success) throw ApiError.badRequest('page and limit must be positive whole numbers');
    const { page, limit } = paging.data;

    {
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
    }
};

/** The steward-authored notification create, shared by every path that serves the in-app inbox. */
export const createNotification = async ({ body, organizationId, userId }: ApiContext) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('Invalid notification: ' + parsed.error.issues.map((issue) => issue.path.join('.') + ' ' + issue.message).join('; '));
    const { userId: targetUserId, title, message, type, actionLabel, actionUrl, data, expiresAt } = parsed.data;

    return withRLSContext({ organizationId }, async (tx) => {
      // A notification can only be addressed to a member of the acting organization.
      const [recipient] = await tx
        .select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, targetUserId),
            isNull(organizationMembers.deletedAt),
          ),
        )
        .limit(1);
      if (!recipient) throw ApiError.notFound('Recipient');

      // Bounded fan-out: one steward cannot flood the organization with authored messages.
      const [sent] = await tx
        .select({ total: count() })
        .from(inAppNotifications)
        .where(and(
          eq(inAppNotifications.organizationId, organizationId),
          sql`(${inAppNotifications.data} -> 'origin' ->> 'userId') = ${userId}`,
          sql` > now() - interval '1 hour'`,
        ));
      if ((sent?.total ?? 0) >= STEWARD_NOTIFICATIONS_PER_HOUR) throw new ApiError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Too many notifications sent this hour');

      const [notification] = await tx
        .insert(inAppNotifications)
        .values({
          userId: targetUserId,
          organizationId,
          title,
          message,
          type: type || 'info',
          actionLabel,
          actionUrl,
          data: { ...(data ?? {}), origin: { kind: 'steward', userId } },
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'notification.create',
        resourceType: 'in_app_notifications',
        resourceId: notification.id,
        // The text is not stored in the audit record; its digest lets the authored message be matched to the actor later.
        details: { recipientUserId: targetUserId, type: type || 'info', contentDigest: createHash('sha256').update(title + '\n' + message).digest('hex') },
      });
      return notification;
    });
};
