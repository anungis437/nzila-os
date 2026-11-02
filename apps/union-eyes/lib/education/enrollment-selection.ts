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
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(Math.round(parsed * 100)) ||
      Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-7) return null;
  return parsed;
}
