/** Governed member-specific session joining; catalogue never exposes credentials. */
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { courseRegistrations, courseSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';
export const GET = withApi({
  auth: { required: true, minRole: 'member' },
  requireOrg: true,
  query: z.object({ sessionId: z.guid() }).strict(),
  openapi: { tags: ['Scheduling'], summary: 'Read virtual joining details for own approved registration' },
}, async ({ organizationId, userId, query }) => {
  if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
  return withRLSContext({ organizationId, userId }, async tx => {
    const [row] = await tx.select({
      registrationId: courseRegistrations.id,
      registrationStatus: courseRegistrations.registrationStatus,
      requiresApproval: courseRegistrations.requiresApproval,
      approvedBy: courseRegistrations.approvedBy,
      cancellationDate: courseRegistrations.cancellationDate,
      courseFee: courseRegistrations.courseFee,
      feePaid: courseRegistrations.feePaid,
      feeWaived: courseRegistrations.feeWaived,
      sessionStatus: courseSessions.sessionStatus,
      startDate: courseSessions.startDate,
      endDate: courseSessions.endDate,
      virtualMeetingUrl: courseSessions.virtualMeetingUrl,
      virtualMeetingAccessCode: courseSessions.virtualMeetingAccessCode,
    }).from(courseRegistrations).innerJoin(courseSessions, and(
      eq(courseSessions.id, courseRegistrations.sessionId),
      eq(courseSessions.courseId, courseRegistrations.courseId),
      eq(courseSessions.organizationId, courseRegistrations.organizationId),
    )).where(and(
      eq(courseRegistrations.organizationId, organizationId),
      eq(courseSessions.organizationId, organizationId),
      eq(courseRegistrations.memberId, userId),
      eq(courseRegistrations.sessionId, query.sessionId),
    )).limit(1);

    const unavailable = () => ApiError.notFound('Session joining instructions unavailable');
    if (!row || row.registrationStatus !== 'registered' || row.cancellationDate ||
      (row.requiresApproval && !row.approvedBy) || row.sessionStatus !== 'scheduled') throw unavailable();
    // Registration does not settle a course fee. Refuse paid-course credentials until
    // a governed payment or waiver is recorded; malformed/unknown fees fail closed.
    if (typeof row.courseFee !== 'string' || !/^\d{1,8}(?:\.\d{1,2})?$/.test(row.courseFee)) throw unavailable();
    if (Number(row.courseFee) > 0 && row.feePaid !== true && row.feeWaived !== true) throw unavailable();
    const today = new Date().toISOString().slice(0, 10);
    if (!row.startDate || !row.endDate || today < row.startDate || today > row.endDate) throw unavailable();
    const url = row.virtualMeetingUrl?.trim();
    if (!url) throw unavailable();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Unsafe URL');
    } catch { throw unavailable(); }

    // A failed audit must roll back this disclosure. Never audit access tokens.
    await persistAtomicAudit(tx, {
      organizationId, userId, action: 'education.session.join_credentials_read',
      resourceType: 'course_sessions', resourceId: query.sessionId,
      details: { registrationId: row.registrationId },
    });
    return { sessionId: query.sessionId, joinUrl: url, accessCode: row.virtualMeetingAccessCode ?? null };
  });
});
