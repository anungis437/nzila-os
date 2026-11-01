import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { calendars, calendarEvents } from '@/db/schema';
import { and, eq, or, notInArray, count, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'List events from a calendar the caller may see' },
}, async ({ request, organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Calendar membership required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid calendar identifier');
  const raw = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(1000, Number(raw.get('page')) || 1));
  const limit = Math.max(1, Math.min(100, Number(raw.get('limit')) || 50));
  const offset = (Math.trunc(page) - 1) * Math.trunc(limit);
  return withRLSContext({ organizationId, userId }, async tx => {
    const [calendar] = await tx.select({
      id: calendars.id, ownerId: calendars.ownerId, isPersonal: calendars.isPersonal,
    }).from(calendars).where(and(
      eq(calendars.id, parsed.data),
      eq(calendars.organizationId, organizationId),
    )).limit(1);
    if (!calendar || (calendar.isPersonal !== false && calendar.ownerId !== userId)) {
      throw ApiError.notFound('Calendar not found');
    }
    const visible = and(
      eq(calendarEvents.calendarId, parsed.data),
      eq(calendarEvents.organizationId, organizationId),
      or(
        and(eq(calendarEvents.isPrivate, false),
          notInArray(calendarEvents.visibility, ['private', 'confidential'])),
        eq(calendarEvents.organizerId, userId),
      ),
    );
    const [rows, totalRows] = await Promise.all([
      tx.select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        description: calendarEvents.description,
        startTime: calendarEvents.startTime,
        endTime: calendarEvents.endTime,
        status: calendarEvents.status,
        organizerId: calendarEvents.organizerId,
        visibility: calendarEvents.visibility,
      }).from(calendarEvents).where(visible).orderBy(desc(calendarEvents.startTime)).limit(Math.trunc(limit)).offset(offset),
      tx.select({ total: count() }).from(calendarEvents).where(visible),
    ]);
    const total = totalRows[0]?.total ?? 0;
    return { data: rows, pagination: {
      page: Math.trunc(page), limit: Math.trunc(limit), total,
      totalPages: Math.ceil(total / Math.trunc(limit)),
    }};
  });
});
