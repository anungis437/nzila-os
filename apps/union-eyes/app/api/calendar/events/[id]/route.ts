import { withApi, ApiError, z, zUUID } from '@/lib/api/framework';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { calendarEvents, calendars } from '@/db/schema';
import { canSeeCalendarEvent, canModifyCalendarEvent } from '@/lib/calendar/event-visibility';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function loadEvent(tx: RLSTx, id: string, organizationId: string) {
  const [event] = await tx.select({
    id: calendarEvents.id,
    calendarId: calendarEvents.calendarId,
    organizationId: calendarEvents.organizationId,
    title: calendarEvents.title,
    description: calendarEvents.description,
    location: calendarEvents.location,
    startTime: calendarEvents.startTime,
    endTime: calendarEvents.endTime,
    eventType: calendarEvents.eventType,
    status: calendarEvents.status,
    organizerId: calendarEvents.organizerId,
    isPrivate: calendarEvents.isPrivate,
    visibility: calendarEvents.visibility,
    calendarOwnerId: calendars.ownerId,
    calendarIsPersonal: calendars.isPersonal,
  }).from(calendarEvents)
    .innerJoin(calendars, eq(calendarEvents.calendarId, calendars.id))
    .where(and(
      eq(calendarEvents.id, id),
      eq(calendarEvents.organizationId, organizationId),
      eq(calendars.organizationId, organizationId),
    )).limit(1);
  if (!event) throw ApiError.notFound('Event not found');
  return event;
}

export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Get an event subject to calendar privacy' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Calendar context required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid event id');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const event = await loadEvent(tx, parsed.data, organizationId);
    if (!canSeeCalendarEvent(event, userId)) throw ApiError.notFound('Event not found');
    const { calendarOwnerId, calendarIsPersonal, ...data } = event;
    return { data };
  });
});

const patchSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  isPrivate: z.boolean().optional(),
  visibility: z.enum(['default', 'public', 'private', 'confidential']).optional(),
  status: z.enum(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show', 'rescheduled']).optional(),
}).strict().refine((body) => Object.keys(body).length > 0);

export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  body: patchSchema,
  openapi: { tags: ['Scheduling'], summary: 'Modify an event the caller organizes' },
}, async ({ organizationId, userId, params, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Calendar context required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid event id');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const event = await loadEvent(tx, parsed.data, organizationId);
    if (!canModifyCalendarEvent(event, userId)) throw ApiError.notFound('Event not found');
    const nextStart = body.startTime ?? event.startTime;
    const nextEnd = body.endTime ?? event.endTime;
    if (nextEnd.getTime() <= nextStart.getTime()) throw ApiError.badRequest('End must follow start');
    const [updated] = await tx.update(calendarEvents)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, parsed.data), eq(calendarEvents.organizationId, organizationId)))
      .returning({ id: calendarEvents.id, title: calendarEvents.title, startTime: calendarEvents.startTime, endTime: calendarEvents.endTime, status: calendarEvents.status });
    if (!updated) throw ApiError.conflict('Event changed');
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'calendar.event.update',
      resourceType: 'calendar_events', resourceId: parsed.data,
      details: { fields: Object.keys(body) },
    });
    return { data: updated };
  });
});

export const DELETE = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Delete an event the caller organizes' },
}, async ({ organizationId, userId, params }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Calendar context required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid event id');
  return withRLSContext({ organizationId, userId }, async (tx) => {
    const event = await loadEvent(tx, parsed.data, organizationId);
    if (!canModifyCalendarEvent(event, userId)) throw ApiError.notFound('Event not found');
    const [deleted] = await tx.delete(calendarEvents)
      .where(and(eq(calendarEvents.id, parsed.data), eq(calendarEvents.organizationId, organizationId)))
      .returning({ id: calendarEvents.id });
    if (!deleted) throw ApiError.conflict('Event changed');
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'calendar.event.delete',
      resourceType: 'calendar_events', resourceId: parsed.data,
      details: { calendarId: event.calendarId },
    });
    return { deleted: true, id: deleted.id };
  });
});
