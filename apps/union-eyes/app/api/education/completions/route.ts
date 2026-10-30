/**
 * Course completion is a transition on a registered learner, never a new
 * registration inserted through an unrestricted generic CRUD facade.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { courseRegistrations } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  openapi: { tags: ['Scheduling'], summary: 'List completed training registrations' },
}, async ({ organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization required');
  return withRLSContext({ organizationId, userId }, async tx => {
    const registrations = await tx.select({
      id: courseRegistrations.id,
      memberId: courseRegistrations.memberId,
      courseId: courseRegistrations.courseId,
      sessionId: courseRegistrations.sessionId,
      completionDate: courseRegistrations.completionDate,
      passed: courseRegistrations.passed,
      certificateIssued: courseRegistrations.certificateIssued,
    }).from(courseRegistrations).where(and(
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.completed, true),
    )).orderBy(desc(courseRegistrations.completionDate)).limit(100);
    return { data: registrations, limit: 100 };
  });
});

const completeSchema = z.object({
  registrationId: z.guid(),
}).strict();

export const POST = withApi({
  auth: { required: true, minRole: 'steward' },
  requireOrg: true,
  body: completeSchema,
  openapi: { tags: ['Scheduling'], summary: 'Attest completion of an attended, passed registration' },
}, async ({ organizationId, userId, body }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization required');
  return withRLSContext({ organizationId, userId }, async tx => {
    const condition = and(
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.id, body.registrationId),
    );
    const [registration] = await tx.select({
      id: courseRegistrations.id,
      attended: courseRegistrations.attended,
      passed: courseRegistrations.passed,
      completed: courseRegistrations.completed,
      memberId: courseRegistrations.memberId,
      courseId: courseRegistrations.courseId,
    }).from(courseRegistrations).where(condition).limit(1).for('update');
    if (!registration) throw ApiError.notFound('Registration not found');
    if (registration.completed) throw ApiError.conflict('Registration already completed');
    if (!registration.attended || registration.passed !== true) {
      throw ApiError.forbidden('Attended and passed training evidence required');
    }
    const [updated] = await tx.update(courseRegistrations).set({
      completed: true,
      completionDate: new Date().toISOString().slice(0, 10),
      completionPercentage: '100.00',
      registrationStatus: 'completed',
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.id, body.registrationId),
    )).returning({ id: courseRegistrations.id, completed: courseRegistrations.completed });
    if (!updated) throw ApiError.conflict('Registration changed');
    await persistAtomicAudit(tx, {
      organizationId, userId,
      action: 'education.registration.complete',
      resourceType: 'course_registrations',
      resourceId: updated.id,
      details: { memberId: registration.memberId, courseId: registration.courseId },
    });
    return { data: updated };
  });
});
