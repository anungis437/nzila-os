/**
 * Calendar event listing excludes another member's personal calendar and
 * private events, even when both records belong to the same organization.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { listPage } from '@/lib/api/list-page';
import { db } from '@/db/db';
import { calendarEvents, calendars } from '@/db/schema';
import { and, eq, or, notInArray, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/** Calendar listing is paginated; a 100-event ceiling must not hide later authorized events. */
export function calendarEventPage(request: { url: string }): { limit: number; offset: number } {
  return listPage(request, 100);
}

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  rlsOrgContext: true,
  openapi: { tags: ['Scheduling'], summary: 'List only authorized calendar events' },
}, async ({ request, organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Calendar identity required');
  const page = calendarEventPage(request);
  // The tenant-bound transaction is authoritative even if the framework's
  // ambient RLS context changes. Both the event and its calendar must match.
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const rows = await tx.select({
      id: calendarEvents.id,
      calendarId: calendarEvents.calendarId,
      title: calendarEvents.title,
      description: calendarEvents.description,
      location: calendarEvents.location,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      status: calendarEvents.status,
      eventType: calendarEvents.eventType,
      organizerId: calendarEvents.organizerId,
    }).from(calendarEvents)
      .innerJoin(calendars, eq(calendarEvents.calendarId, calendars.id))
      .where(and(
        eq(calendarEvents.organizationId, organizationId),
        eq(calendars.organizationId, organizationId),
        or(eq(calendars.isPersonal, false), eq(calendars.ownerId, userId)),
        or(
          and(eq(calendarEvents.isPrivate, false),
            notInArray(calendarEvents.visibility, ['private', 'confidential'])),
          eq(calendarEvents.organizerId, userId),
        ),
      ))
      .orderBy(desc(calendarEvents.startTime), desc(calendarEvents.id))
      .limit(page.limit + 1).offset(page.offset);
    const hasMore = rows.length > page.limit;
    return { data: rows.slice(0, page.limit), limit: page.limit, offset: page.offset, hasMore };
  });
});

const { POST } = crudRoutes({
  table: calendarEvents,
  pk: 'id',
  tags: ['Scheduling'],
  orgScoped: true,
  writeRole: 'steward',
  beforeCreate: async (values, { organizationId, userId }) => {
    if (!organizationId || !userId || typeof values.calendarId !== 'string') {
      throw ApiError.badRequest('Calendar context required');
    }
    const [calendar] = await db.select({
      id: calendars.id, ownerId: calendars.ownerId, isPersonal: calendars.isPersonal,
    }).from(calendars).where(and(
      eq(calendars.id, values.calendarId),
      eq(calendars.organizationId, organizationId),
    )).limit(1);
    if (!calendar || (calendar.isPersonal && calendar.ownerId !== userId)) {
      throw ApiError.notFound('Calendar not found');
    }
    // The authenticated actor, not the client, is the event organizer.
    return { ...values, organizationId, organizerId: userId, createdBy: userId };
  },
});
export { POST };
