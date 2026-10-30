import { withApi, ApiError, z, zUUID } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { courseRegistrations, courseSessions } from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const form = z.object({
  registrationId: z.guid(),
  attended: z.boolean(),
  attendanceHours: z.number().nonnegative().max(24).optional(),
}).strict();

export const GET = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'Get course session attendance' },
}, async ({ organizationId, userId, params }) => {
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
    }).from(courseRegistrations).where(and(
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.sessionId, parsed.data),
    )).limit(500);
    return { sessionId: parsed.data, registrations };
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
    const [registration] = await tx.select({ id: courseRegistrations.id })
      .from(courseRegistrations).where(condition).limit(1).for('update');
    if (!registration) throw ApiError.notFound('Registration not found');
    const [updated] = await tx.update(courseRegistrations).set({
      attended: body.attended,
      attendanceHours: body.attendanceHours?.toFixed(2),
      updatedAt: new Date().toISOString(),
    }).where(condition).returning({ id: courseRegistrations.id, attended: courseRegistrations.attended });
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
