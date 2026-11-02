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

/** Unknown fee is not zero: a missing or invalid amount must never display as Free. */
export function parseCourseFee(value: unknown): number | null {
  if (value === null || value === undefined || value === '' ||
      (typeof value !== 'string' && typeof value !== 'number')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
