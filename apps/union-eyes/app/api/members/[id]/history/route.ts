/**
 * Member history timeline
 * GET /api/members/[id]/history — list the caller's own history events
 * PATCH /api/members/[id]/history — update a history event visibility
 * DELETE /api/members/[id]/history — remove a history event (its content is preserved in the audit record)
 *
 * A member's history (status changes, case filings, payments) belongs to that member. There is no records authority
 * that names who else may read it, so reading another member's timeline is refused rather than granted by rank.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { memberHistoryEvents } from '@/db/schema/member-profile-v2-schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members'],
      summary: 'Get member history',
      description: 'Returns the timeline of status changes, profile updates, and case filings for the calling member.',
    },
  },
  async ({ params, request, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const memberId = params.id;
    if (memberId !== userId) {
      throw ApiError.forbidden("A member's history is available only to that member");
    }
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
    const category = url.searchParams.get('category');

    const conditions = [
      eq(memberHistoryEvents.userId, memberId),
      eq(memberHistoryEvents.organizationId, organizationId),
    ];
    if (category) {
      conditions.push(eq(memberHistoryEvents.eventCategory, category));
    }

    return withRLSContext({ organizationId }, (tx) =>
      tx
        .select()
        .from(memberHistoryEvents)
        .where(and(...conditions))
        .orderBy(desc(memberHistoryEvents.eventDate))
        .limit(limit),
    );
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Members'],
      summary: 'Update history event',
      description: 'Updates visibility or metadata of a history event.',
    },
  },
  async ({ params, request, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const memberId = params.id;
    const body = await request.json();
    const { eventId, isPublic, visibleToMember } = body as {
      eventId: string;
      isPublic?: boolean;
      visibleToMember?: boolean;
    };

    if (!eventId) throw ApiError.badRequest('eventId is required');

    const updates: Record<string, unknown> = {};
    if (typeof isPublic === 'boolean') updates.isPublic = isPublic;
    if (typeof visibleToMember === 'boolean') updates.visibleToMember = visibleToMember;

    if (Object.keys(updates).length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    return withRLSContext({ organizationId }, async (tx) => {
      const [updated] = await tx
        .update(memberHistoryEvents)
        .set(updates)
        .where(
          and(
            eq(memberHistoryEvents.id, eventId),
            eq(memberHistoryEvents.userId, memberId),
            eq(memberHistoryEvents.organizationId, organizationId),
          ),
        )
        .returning();

      if (!updated) throw ApiError.notFound('History event');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'member.history_event.update',
        resourceType: 'member_history_events',
        resourceId: eventId,
        details: { memberId, ...updates },
      });
      return updated;
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Members'],
      summary: 'Delete history event',
      description: 'Removes a history event record.',
    },
  },
  async ({ params, request, userId, organizationId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const memberId = params.id;
    const body = await request.json();
    const { eventId } = body as { eventId: string };

    if (!eventId) throw ApiError.badRequest('eventId is required');

    return withRLSContext({ organizationId }, async (tx) => {
      const [deleted] = await tx
        .delete(memberHistoryEvents)
        .where(
          and(
            eq(memberHistoryEvents.id, eventId),
            eq(memberHistoryEvents.userId, memberId),
            eq(memberHistoryEvents.organizationId, organizationId),
          ),
        )
        .returning();

      if (!deleted) throw ApiError.notFound('History event');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'member.history_event.delete',
        resourceType: 'member_history_events',
        resourceId: eventId,
        details: {
          memberId,
          eventType: deleted.eventType,
          eventCategory: deleted.eventCategory,
          eventDate: deleted.eventDate,
          eventTitle: deleted.eventTitle,
        },
      });
      return { id: deleted.id, deleted: true };
    });
  },
);
