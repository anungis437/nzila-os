/**
 * Certifications must be derived from a completed, passed and owned
 * registration. A generic free-form insert could forge verification.
 */
import { and, eq } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { memberCertifications, courseRegistrations, trainingCourses } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: memberCertifications,
  pk: 'id',
  tags: ['Scheduling'],
  orgScoped: true,
  ownerColumn: 'memberId',
  staffReadsAll: true,
  readRole: 'member',
  writeRole: 'steward',
  beforeCreate: async (values, { organizationId }) => {
    if (!organizationId) throw ApiError.forbidden('Organization context required');
    const registrationId = values.registrationId;
    if (typeof registrationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,28}$/i.test(registrationId)) {
      throw ApiError.badRequest('A completed training registration is required');
    }
    const [registration] = await db.select().from(courseRegistrations).where(and(
      eq(courseRegistrations.id, registrationId),
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseRegistrations.completed, true),
      eq(courseRegistrations.passed, true),
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
});
export { GET, POST };
