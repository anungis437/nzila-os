/**
 * Strict readers for the rows the education CRUD routes send (training_courses, course_sessions, course_registrations, member_certifications).
 *
 * A column the database never leaves empty that is missing from a row means the response is not what the route promises: that is an error for
 * the screen to show, not a row to complete with a placeholder. numeric columns arrive as strings ("8.00"), date columns as "YYYY-MM-DD", and a
 * nullable column that holds nothing is null here, never an invented value.
 */
import { ApiShapeError } from '@/lib/client/api-envelope';
import { asRecord, flagOrFalse, optionalString, requiredString } from '@/lib/client/row-fields';
import { parseCourseFee, type EnrollmentSession } from '@/lib/education/enrollment-selection';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function numberOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new ApiShapeError(`${key} is not a number`);
  return parsed;
}

function requiredDay(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key);
  if (!DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

function optionalDay(row: Record<string, unknown>, key: string): string | null {
  const value = optionalString(row, key);
  if (value === null) return null;
  if (!DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

export { formatDay } from '@/lib/client/day';

/** Today as "YYYY-MM-DD" (UTC), the form the stored dates are compared in. */
export const todayDay = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

export function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86_400_000);
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  deliveryMethod: string;
  difficulty: string | null;
  durationHours: number | null;
  durationDays: number | null;
  providesCertification: boolean;
  certificationName: string | null;
  clcApproved: boolean;
  /** null when the route sent no valid fee: an unknown fee is never shown as free. */
  fee: number | null;
  minEnrollment: number | null;
  maxEnrollment: number | null;
  isActive: boolean;
}

export function readCourse(value: unknown): Course {
  const row = asRecord(value, 'course');
  return {
    id: requiredString(row, 'id'),
    code: requiredString(row, 'courseCode'),
    name: requiredString(row, 'courseName'),
    description: optionalString(row, 'courseDescription'),
    category: requiredString(row, 'courseCategory'),
    deliveryMethod: requiredString(row, 'deliveryMethod'),
    difficulty: optionalString(row, 'courseDifficulty'),
    durationHours: numberOrNull(row, 'durationHours'),
    durationDays: numberOrNull(row, 'durationDays'),
    providesCertification: flagOrFalse(row, 'providesCertification'),
    certificationName: optionalString(row, 'certificationName'),
    clcApproved: flagOrFalse(row, 'clcApproved'),
    fee: parseCourseFee(row.courseFee),
    minEnrollment: numberOrNull(row, 'minEnrollment'),
    maxEnrollment: numberOrNull(row, 'maxEnrollment'),
    isActive: row.isActive === true,
  };
}

export interface CourseSession {
  id: string;
  courseId: string;
  code: string;
  name: string | null;
  startDate: string;
  endDate: string;
  deliveryMethod: string;
  venueName: string | null;
  status: string | null;
  registrationOpenDate: string | null;
  registrationCloseDate: string | null;
  maxEnrollment: number | null;
  registrationCount: number | null;
}

export function readSession(value: unknown): CourseSession {
  const row = asRecord(value, 'session');
  return {
    id: requiredString(row, 'id'),
    courseId: requiredString(row, 'courseId'),
    code: requiredString(row, 'sessionCode'),
    name: optionalString(row, 'sessionName'),
    startDate: requiredDay(row, 'startDate'),
    endDate: requiredDay(row, 'endDate'),
    deliveryMethod: requiredString(row, 'deliveryMethod'),
    venueName: optionalString(row, 'venueName'),
    status: optionalString(row, 'sessionStatus'),
    registrationOpenDate: optionalDay(row, 'registrationOpenDate'),
    registrationCloseDate: optionalDay(row, 'registrationCloseDate'),
    maxEnrollment: numberOrNull(row, 'maxEnrollment'),
    registrationCount: numberOrNull(row, 'registrationCount'),
  };
}

/** What the enrollment guard needs of a session. A session with no status is not scheduled: the route refuses it the same way. */
export function toEnrollmentSession(session: CourseSession): EnrollmentSession {
  return {
    id: session.id,
    courseId: session.courseId,
    sessionStatus: session.status ?? '',
    startDate: session.startDate,
    endDate: session.endDate,
    registrationOpenDate: session.registrationOpenDate,
    registrationCloseDate: session.registrationCloseDate,
    maxEnrollment: session.maxEnrollment,
    registrationCount: session.registrationCount,
  };
}

export interface Registration {
  id: string;
  courseId: string;
  sessionId: string;
  status: string | null;
  attended: boolean;
  completed: boolean;
  passed: boolean | null;
}

export function readRegistration(value: unknown): Registration {
  const row = asRecord(value, 'registration');
  const passed = row.passed;
  if (passed !== null && passed !== undefined && typeof passed !== 'boolean') throw new ApiShapeError('passed is not a boolean');
  return {
    id: requiredString(row, 'id'),
    courseId: requiredString(row, 'courseId'),
    sessionId: requiredString(row, 'sessionId'),
    status: optionalString(row, 'registrationStatus'),
    attended: flagOrFalse(row, 'attended'),
    completed: flagOrFalse(row, 'completed'),
    passed: passed ?? null,
  };
}

export interface Certification {
  id: string;
  name: string;
  number: string | null;
  type: string | null;
  issuer: string | null;
  issueDate: string;
  expiryDate: string | null;
  status: string | null;
  verified: boolean;
  revoked: boolean;
  renewalRequired: boolean;
  renewalDate: string | null;
  clcRegistered: boolean;
  clcRegistrationNumber: string | null;
  certificateUrl: string | null;
  digitalBadgeUrl: string | null;
}

export function readCertification(value: unknown): Certification {
  const row = asRecord(value, 'certification');
  return {
    id: requiredString(row, 'id'),
    name: requiredString(row, 'certificationName'),
    number: optionalString(row, 'certificationNumber'),
    type: optionalString(row, 'certificationType'),
    issuer: optionalString(row, 'issuedByOrganization'),
    issueDate: requiredDay(row, 'issueDate'),
    expiryDate: optionalDay(row, 'expiryDate'),
    status: optionalString(row, 'certificationStatus'),
    // `verified` defaults to true in the table, but the certification route stores candidates as unverified: a missing answer is never "verified".
    verified: row.verified === true,
    revoked: flagOrFalse(row, 'revoked'),
    renewalRequired: flagOrFalse(row, 'renewalRequired'),
    renewalDate: optionalDay(row, 'renewalDate'),
    clcRegistered: flagOrFalse(row, 'clcRegistered'),
    clcRegistrationNumber: optionalString(row, 'clcRegistrationNumber'),
    certificateUrl: optionalString(row, 'certificateUrl'),
    digitalBadgeUrl: optionalString(row, 'digitalBadgeUrl'),
  };
}

export type CertificationState = 'revoked' | 'suspended' | 'pending' | 'expired' | 'expiring' | 'active';

/** Days after which a certification that has an expiry date counts as expiring soon. */
export const EXPIRING_WITHIN_DAYS = 90;

/** What a certification is today, from what the route stores: nothing is "active" before it is verified, and an expiry date in the past is expired whatever the status says. */
export function certificationState(cert: Certification, today: string = todayDay()): CertificationState {
  if (cert.revoked || cert.status === 'revoked') return 'revoked';
  if (cert.status === 'suspended') return 'suspended';
  if (!cert.verified || cert.status === 'pending_verification') return 'pending';
  if (cert.status === 'expired' || (cert.expiryDate !== null && cert.expiryDate < today)) return 'expired';
  if (cert.expiryDate !== null && daysBetween(today, cert.expiryDate) <= EXPIRING_WITHIN_DAYS) return 'expiring';
  return 'active';
}

/** An https address only: a stored link of any other scheme is not offered. */
export function safeHttpsUrl(value: string | null): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export const humanizeCode = (code: string): string => code.replace(/[-_]+/g, ' ');
