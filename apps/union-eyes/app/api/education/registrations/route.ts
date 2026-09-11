/**
 * CRUD collection route for courseRegistrations
 *
 * round 53 (FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE, TRAINING_AND_REGISTRATION
 * family): crud-factory's ownerColumn only restricts READS (GET/PATCH/
 * DELETE) to the caller's own row — it has no auto-set path on CREATE
 * (only a column literally named createdBy is force-set), so memberId was
 * previously a fully client-controllable field on POST, letting any
 * 'member' register an arbitrary victim memberId for a course/session
 * without their consent. beforeCreate now forces memberId to the caller's
 * own id. Also validates courseId/sessionId belong to the caller's own
 * organization before allowing the insert — course_registrations has its
 * own independently-declared organizationId (not derived from a courseId/
 * sessionId FK), so nothing previously stopped a member from referencing
 * another organization's course or session id in a registration row that
 * itself lands in their own org (a cross-org FK injection / data-integrity
 * defect, round-53 doctrine section 27).
 */
import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { crudRoutes } from '@/lib/api/crud-factory';
import { db } from '@/db/db';
import { courseRegistrations, courseSessions, trainingCourses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: courseRegistrations,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  ownerColumn: 'memberId',
  readRole: 'member',
  writeRole: 'member',
  beforeCreate: async (values, ctx) => {
    const courseId = values.courseId as string | undefined;
    const sessionId = values.sessionId as string | undefined;

    if (courseId) {
      const [course] = await db.select({ id: trainingCourses.id }).from(trainingCourses)
        .where(and(eq(trainingCourses.id, courseId), eq(trainingCourses.organizationId, ctx.organizationId!)));
      if (!course) throw ApiError.badRequest('courseId does not belong to your organization');
    }
    if (sessionId) {
      const [session] = await db.select({ id: courseSessions.id }).from(courseSessions)
        .where(and(eq(courseSessions.id, sessionId), eq(courseSessions.organizationId, ctx.organizationId!)));
      if (!session) throw ApiError.badRequest('sessionId does not belong to your organization');
    }

    return { ...values, memberId: ctx.userId };
  },
});
export { GET, POST };
