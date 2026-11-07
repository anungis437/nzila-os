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
import { and, count, eq } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { isCheckViolation, isUniqueViolation } from '@/lib/db/unique-violation';
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
  staffReadsAll: true,
  readRole: 'member',
  writeRole: 'member',
  // A member's own rows are already scoped by ownerColumn; these only matter for a staff caller
  // (staffReadsAll) narrowing the organization-wide list down to one member or one registration
  // status, rather than always reading every registration of every member.
  listFilters: { equals: { memberId: 'memberId', registrationStatus: 'registrationStatus' } },
  // Enrollment accepts intent and logistical preferences only. Payment,
  // waiver, approval, attendance and completion fields are server-owned.
  // Refuse unsupported client fields instead of reporting a successful
  // enrollment while silently ignoring a forged payment assertion.
  writableFields: [
    'courseId', 'sessionId', 'travelRequired', 'travelSubsidyRequested',
    'accommodationRequired', 'notes',
  ],
  // The checks below are friendly early answers; the unique index and the capacity trigger (migration 0040) settle a race.
  mapCreateError: (error) =>
    isCheckViolation(error) ? ApiError.conflict('This session is full')
      : isUniqueViolation(error) ? ApiError.conflict('Already registered for this session')
      : null,
  beforeCreate: async (values, ctx) => {
    if (!ctx.organizationId || !ctx.userId) throw ApiError.forbidden('Organization membership required');
    // Defense in depth for direct callers and future CRUD changes. The
    // factory may add only its own tenant/creator fields before this hook.
    const allowed = new Set([
      'courseId', 'sessionId', 'travelRequired', 'travelSubsidyRequested',
      'accommodationRequired', 'notes', 'organizationId', 'createdBy',
    ]);
    for (const field of Object.keys(values)) {
      if (!allowed.has(field)) throw ApiError.badRequest(`Enrollment field ${field} is not allowed`);
    }
    if (values.organizationId !== undefined && values.organizationId !== ctx.organizationId) {
      throw ApiError.forbidden('Organization mismatch');
    }
    if (values.createdBy !== undefined && values.createdBy !== ctx.userId) {
      throw ApiError.forbidden('Creator mismatch');
    }
    for (const field of ['travelRequired', 'travelSubsidyRequested', 'accommodationRequired'] as const) {
      if (values[field] !== undefined && typeof values[field] !== 'boolean') {
        throw ApiError.badRequest(`${field} must be a boolean`);
      }
    }
    if (values.notes !== undefined && values.notes !== null &&
      (typeof values.notes !== 'string' || values.notes.length > 2000)) {
      throw ApiError.badRequest('notes must be text of at most 2000 characters');
    }
    const courseId = values.courseId;
    const sessionId = values.sessionId;
    if (typeof courseId !== 'string' || typeof sessionId !== 'string') {
      throw ApiError.badRequest('Course and session are required');
    }
    const [course] = await db.select({ id: trainingCourses.id, courseFee: trainingCourses.courseFee }).from(trainingCourses)
      .where(and(eq(trainingCourses.id, courseId), eq(trainingCourses.organizationId, ctx.organizationId),
        eq(trainingCourses.isActive, true))).limit(1);
    if (!course) throw ApiError.badRequest('Course is not available to this organization');
    // Fee is a server-owned enrollment snapshot. Never default an unknown paid
    // course to free or accept a client-supplied price/waiver/payment assertion.
    if (typeof course.courseFee !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(course.courseFee)) {
      throw ApiError.conflict('Course fee is unavailable');
    }
    const [session] = await db.select({
      id: courseSessions.id,
      sessionStatus: courseSessions.sessionStatus,
      endDate: courseSessions.endDate,
      maxEnrollment: courseSessions.maxEnrollment,
      registrationOpenDate: courseSessions.registrationOpenDate,
      registrationCloseDate: courseSessions.registrationCloseDate,
    }).from(courseSessions)
      .where(and(eq(courseSessions.id, sessionId),
        eq(courseSessions.courseId, courseId),
        eq(courseSessions.organizationId, ctx.organizationId))).limit(1);
    if (!session) throw ApiError.badRequest('Session does not belong to this course and organization');

    // Registration is open only for a scheduled session inside its registration window, and only while there is room.
    const today = new Date().toISOString().slice(0, 10);
    // A null/unknown status must not be treated as scheduled. Likewise,
    // an already-ended session cannot accept a new registration even if
    // its status or optional registration-window fields were left stale.
    if (session.sessionStatus !== 'scheduled' || !session.endDate || session.endDate < today) {
      throw ApiError.conflict('This session is not open for registration');
    }
    if ((session.registrationOpenDate && session.registrationOpenDate > today) || (session.registrationCloseDate && session.registrationCloseDate < today)) {
      throw ApiError.conflict('Registration for this session is not open');
    }
    if (session.maxEnrollment != null) {
      const [{ registered }] = await db.select({ registered: count() }).from(courseRegistrations)
        .where(and(eq(courseRegistrations.organizationId, ctx.organizationId), eq(courseRegistrations.sessionId, sessionId), eq(courseRegistrations.registrationStatus, 'registered')));
      if (Number(registered) >= session.maxEnrollment) throw ApiError.conflict('This session is full');
    }
    const [existing] = await db.select({ id: courseRegistrations.id }).from(courseRegistrations)
      .where(and(eq(courseRegistrations.organizationId, ctx.organizationId),
        eq(courseRegistrations.memberId, ctx.userId),
        eq(courseRegistrations.courseId, courseId),
        eq(courseRegistrations.sessionId, sessionId))).limit(1);
    if (existing) throw ApiError.conflict('Already registered for this session');

    // Explicit allowlist: completion, payment, attendance, approval, grade,
    // certification and subsidy authority are never client-set at enrollment.
    return {
      organizationId: ctx.organizationId,
      memberId: ctx.userId,
      courseId,
      sessionId,
      registrationStatus: 'registered',
      completed: false,
      attended: false,
      passed: null,
      certificateIssued: false,
      feePaid: false,
      feeWaived: false,
      courseFee: course.courseFee,
      travelRequired: values.travelRequired === true,
      travelSubsidyRequested: values.travelSubsidyRequested === true,
      accommodationRequired: values.accommodationRequired === true,
      notes: typeof values.notes === 'string' ? values.notes : null,
    };

  },
});
export { GET, POST };
