/**
 * Certifications must be derived from a completed, passed and owned
 * registration. A generic free-form insert could forge verification.
 */
import { and, eq, isNull } from 'drizzle-orm';
import { crudRoutes, queryIdMutations, type CrudOptions } from '@/lib/api/crud-factory';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { memberCertifications, courseRegistrations, trainingCourses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const certificationCrudOptions: CrudOptions & { itemRoute?: false } = {
  table: memberCertifications,
  pk: 'id',
  tags: ['Scheduling'],
  orgScoped: true,
  ownerColumn: 'memberId',
  staffReadsAll: true,
  readRole: 'member',
  writeRole: 'steward',
  // The client nominates only an existing registration. Identity, verification,
  // badge, issuer and lifecycle fields are never client-issued attestations.
  writableFields: ['registrationId'],
  beforeCreate: async (values, { organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Authenticated organization context required');
    // The factory refuses unknown client fields; retain the invariant for
    // direct hook callers and future CRUD refactors, before any database read.
    const allowed = new Set(['registrationId', 'organizationId', 'createdBy']);
    for (const field of Object.keys(values)) {
      if (!allowed.has(field)) throw ApiError.badRequest(`Certification field ${field} is not allowed`);
    }
    if (values.organizationId !== undefined && values.organizationId !== organizationId) {
      throw ApiError.forbidden('Organization mismatch');
    }
    if (values.createdBy !== undefined && values.createdBy !== userId) {
      throw ApiError.forbidden('Creator mismatch');
    }
    const registrationId = values.registrationId;
    if (typeof registrationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId)) {
      throw ApiError.badRequest('A completed training registration is required');
    }
    const [registration] = await db.select().from(courseRegistrations).where(and(
      eq(courseRegistrations.id, registrationId),
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.completed, true),
      eq(courseRegistrations.passed, true),
      eq(courseRegistrations.registrationStatus, 'completed'),
      isNull(courseRegistrations.cancellationDate),
    )).limit(1);
    if (!registration) throw ApiError.badRequest('No verified completed training registration');
    const [course] = await db.select().from(trainingCourses).where(and(
      eq(trainingCourses.id, registration.courseId),
      eq(trainingCourses.organizationId, organizationId),
      eq(trainingCourses.providesCertification, true),
    )).limit(1);
    if (!course) throw ApiError.badRequest('Course does not issue certifications');
    // Record an evidence-backed certification candidate; an independent
    // verification workflow must make it active. Never accept caller-provided
    // verifiedBy, verificationDate, revocation or badge attestations.
    return {
      organizationId,
      memberId: registration.memberId,
      courseId: course.id,
      sessionId: registration.sessionId,
      registrationId: registration.id,
      certificationName: course.certificationName ?? course.courseName,
      certificationType: 'course_completion',
      issueDate: new Date().toISOString().slice(0, 10),
      certificationStatus: 'pending_verification',
      verified: false,
      revoked: false,
      clcRegistered: false,
      certificateUrl: null,
      digitalBadgeUrl: null,
      verifiedBy: null,
      verificationDate: null,
    };
  },
};

const { GET, POST } = crudRoutes(certificationCrudOptions);
// No [id]/route.ts exists for certifications; the admin screens submit edits and deletes with
// `?id=` on this collection URL instead, so the item-mode handlers (same options, same
// authorization) are exposed here rather than under a path segment.
const { PATCH, DELETE } = queryIdMutations(crudRoutes({ ...certificationCrudOptions, itemRoute: true }));
export { GET, POST, PATCH, DELETE };
