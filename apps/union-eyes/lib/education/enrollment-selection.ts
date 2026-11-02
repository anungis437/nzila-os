/**
 * Client-side enrollment integrity guard. The server independently validates
 * the tenant, member identity, course/session relationship and capacity.
 */
export type EnrollmentSession = {
  id: string;
  courseId: string;
  sessionStatus: string;
  startDate?: string | null;
  endDate?: string | null;
  registrationOpenDate?: string | null;
  registrationCloseDate?: string | null;
  maxEnrollment?: number | null;
  registrationCount?: number | null;
};

export function buildEducationEnrollment(
  courseId: string,
  sessionId: string,
  sessions: readonly EnrollmentSession[],
  today: string = new Date().toISOString().slice(0, 10),
): { courseId: string; sessionId: string } {
  const session = sessions.find(s => s.id === sessionId && s.courseId === courseId);
  if (!session || session.sessionStatus !== 'scheduled' ||
      (session.registrationOpenDate && session.registrationOpenDate > today) ||
      (session.registrationCloseDate && session.registrationCloseDate < today) ||
      (session.maxEnrollment != null && session.registrationCount != null &&
       session.registrationCount >= session.maxEnrollment)) {
    throw new Error('Select an available session for this course');
  }
  return { courseId, sessionId };
}
