import { withApi, ApiError, z, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { courseRegistrations, courseSessions } from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { and, eq } from 'drizzle-orm';
import { attendanceHoursForUpdate, isAttendanceEditable } from './attendance-policy';

export const dynamic = 'force-dynamic';

const form = z.object({
  registrationId: z.guid(),
  attended: z.boolean(),
  attendanceHours: z.number().nonnegative().max(24).optional(),
}).strict();

export const GET = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  query: z.object({ page: z.coerce.number().int().min(1).max(10000).default(1) }),
  openapi: { tags: ['Scheduling'], summary: 'Get course session attendance' },
}, async ({ organizationId, userId, params, query }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid session ID');
  return withRLSContext({ organizationId, userId }, async tx => {
    const [session] = await tx.select({ id: courseSessions.id }).from(courseSessions).where(and(
      eq(courseSessions.id, parsed.data), eq(courseSessions.organizationId, organizationId),
    )).limit(1);
    if (!session) throw ApiError.notFound('Session not found');
    const registrations = await tx.select({
      id: courseRegistrations.id,
      memberId: courseRegistrations.memberId,
      registrationStatus: courseRegistrations.registrationStatus,
      attended: courseRegistrations.attended,
      attendanceHours: courseRegistrations.attendanceHours,
      completed: courseRegistrations.completed,
    }).from(courseRegistrations).where(and(
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.sessionId, parsed.data),
    )).orderBy(courseRegistrations.id).limit(101).offset((query.page - 1) * 100);
    return {
      sessionId: parsed.data,
      registrations: registrations.slice(0, 100),
      pagination: { page: query.page, hasMore: registrations.length > 100 },
    };
  });
});

export const PATCH = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  body: form,
  openapi: { tags: ['Scheduling'], summary: 'Record attended hours in session' },
}, async ({ organizationId, userId, params, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization required');
  const parsed = zUUID.safeParse(params.id);
  if (!parsed.success) throw ApiError.badRequest('Invalid session ID');
  return withRLSContext({ organizationId, userId }, async tx => {
    const [session] = await tx.select({ id: courseSessions.id }).from(courseSessions).where(and(
      eq(courseSessions.id, parsed.data), eq(courseSessions.organizationId, organizationId),
    )).limit(1);
    if (!session) throw ApiError.notFound('Session not found');
    const condition = and(
      eq(courseRegistrations.id, body.registrationId),
      eq(courseRegistrations.sessionId, parsed.data),
      eq(courseRegistrations.organizationId, organizationId),
    );
    const [registration] = await tx.select({
      id: courseRegistrations.id,
      registrationStatus: courseRegistrations.registrationStatus,
      completed: courseRegistrations.completed,
      cancellationDate: courseRegistrations.cancellationDate,
      requiresApproval: courseRegistrations.requiresApproval,
      approvedBy: courseRegistrations.approvedBy,
      attendanceHours: courseRegistrations.attendanceHours,
    })
      .from(courseRegistrations).where(condition).limit(1).for('update');
    if (!registration) throw ApiError.notFound('Registration not found');
    if (!isAttendanceEditable(registration)) {
      throw ApiError.conflict('Attendance cannot be changed for an inactive, completed or unapproved registration');
    }
    let attendanceHours: string | null;
    try {
      attendanceHours = attendanceHoursForUpdate(body.attended, body.attendanceHours, registration.attendanceHours);
    } catch {
      throw ApiError.badRequest('Attendance hours cannot be positive when attended is false');
    }
    const [updated] = await tx.update(courseRegistrations).set({
      attended: body.attended,
      attendanceHours,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(courseRegistrations.id, body.registrationId),
      eq(courseRegistrations.sessionId, parsed.data),
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.registrationStatus, registration.registrationStatus!),
      eq(courseRegistrations.completed, false),
    )).returning({ id: courseRegistrations.id, attended: courseRegistrations.attended });
    if (!updated) throw ApiError.conflict('Registration changed');
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'education.attendance.record',
      resourceType: 'course_registrations', resourceId: updated.id,
      details: { sessionId: parsed.data, attended: body.attended },
    });
    return { data: updated };
  });
});

export const DELETE = withApi({
  auth: { required: true, minRole: 'admin' },
  openapi: { tags: ['Scheduling'], summary: 'Attendance correction is a governed operation' },
}, async () => {
  throw ApiError.notImplemented('Attendance deletion requires a governed correction workflow');
});
