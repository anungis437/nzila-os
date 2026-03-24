/**
 * Member history timeline
 * GET /api/members/[id]/history — list history events for a member
 * PATCH /api/members/[id]/history — update a history event visibility
 * DELETE /api/members/[id]/history — soft-remove a history event
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { memberHistoryEvents } from '@/db/schema/member-profile-v2-schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Members'],
      summary: 'Get member history',
      description: 'Returns timeline of status changes, profile updates, and case filings for a member.',
    },
  },
  async ({ params, request }) => {
    const memberId = params.id;
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
    const category = url.searchParams.get('category');

    const conditions = [eq(memberHistoryEvents.userId, memberId)];
    if (category) {
      conditions.push(eq(memberHistoryEvents.eventCategory, category));
    }

    const events = await db
      .select()
      .from(memberHistoryEvents)
      .where(and(...conditions))
      .orderBy(desc(memberHistoryEvents.eventDate))
      .limit(limit);

    return { data: events };
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
  async ({ params, request }) => {
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

    const [updated] = await db
      .update(memberHistoryEvents)
      .set(updates)
      .where(
        and(
          eq(memberHistoryEvents.id, eventId),
          eq(memberHistoryEvents.userId, memberId),
        ),
      )
      .returning();

    if (!updated) throw ApiError.notFound('History event');

    return { data: updated };
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
  async ({ params, request }) => {
    const memberId = params.id;
    const body = await request.json();
    const { eventId } = body as { eventId: string };

    if (!eventId) throw ApiError.badRequest('eventId is required');

    const [deleted] = await db
      .delete(memberHistoryEvents)
      .where(
        and(
          eq(memberHistoryEvents.id, eventId),
          eq(memberHistoryEvents.userId, memberId),
        ),
      )
      .returning({ id: memberHistoryEvents.id });

    if (!deleted) throw ApiError.notFound('History event');

    return { data: { id: deleted.id, deleted: true } };
  },
);
