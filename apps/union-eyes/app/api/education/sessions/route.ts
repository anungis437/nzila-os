/**
 * CRUD collection route for courseSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { courseSessions, trainingCourses } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { ApiError } from '@/lib/api/errors';

/**
 * Validate the scheduling contract before a tenant lookup or database write.
 * PostgreSQL date coercion is not an acceptable validation policy: invalid or
 * ambiguous dates, negative capacity and unsafe joining links must fail closed.
 * A null optional registration window or capacity remains legitimate.
 */
function isoDate(value: unknown, field: string, optional = false): string | null {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest(`${field} must be a YYYY-MM-DD calendar date`);
  }
  // Date parsing must not normalize invalid dates or silently reinterpret years 0000–0099.
  const [year, month, day] = value.split('-').map(Number);
  // PostgreSQL has no year zero; refuse it before reaching the database.
  if (year === 0) throw ApiError.badRequest(`${field} is not a valid calendar date`);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw ApiError.badRequest(`${field} is not a valid calendar date`);
  }
  return value;
}

export function validateEducationSessionCreate(values: Record<string, unknown>): void {
  const start = isoDate(values.startDate, 'startDate')!;
  const end = isoDate(values.endDate, 'endDate')!;
  const open = isoDate(values.registrationOpenDate, 'registrationOpenDate', true);
  const close = isoDate(values.registrationCloseDate, 'registrationCloseDate', true);
  if (start > end) throw ApiError.badRequest('Session end date precedes start date');
  if (open && close && open > close) throw ApiError.badRequest('Registration window is reversed');
  if ((open && open > end) || (close && close > end)) {
    throw ApiError.badRequest('Registration window extends beyond the session');
  }
  if (values.maxEnrollment !== null && values.maxEnrollment !== undefined &&
    (!Number.isSafeInteger(values.maxEnrollment) || (values.maxEnrollment as number) < 1 ||
      (values.maxEnrollment as number) > 100000)) {
    throw ApiError.badRequest('maxEnrollment must be a positive bounded integer');
  }
  for (const [field, maximum] of [['sessionCode', 50], ['deliveryMethod', 50]] as const) {
    const value = values[field];
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum) {
      throw ApiError.badRequest(`${field} is required and must be at most ${maximum} characters`);
    }
  }
  const accessCode = values.virtualMeetingAccessCode;
  if (accessCode !== undefined && accessCode !== null &&
    (typeof accessCode !== 'string' || accessCode.trim().length === 0 || accessCode.length > 50)) {
    throw ApiError.badRequest('virtualMeetingAccessCode must be at most 50 characters');
  }
  const meetingUrl = values.virtualMeetingUrl;
  if (meetingUrl !== undefined && meetingUrl !== null) {
    if (typeof meetingUrl !== 'string' || meetingUrl.length > 2048) {
      throw ApiError.badRequest('virtualMeetingUrl must be a bounded HTTPS URL');
    }
    try {
      const url = new URL(meetingUrl);
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
        throw new Error('Unsafe meeting URL');
      }
    } catch {
      throw ApiError.badRequest('virtualMeetingUrl must be an HTTPS URL without embedded credentials');
    }
  }
}

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: courseSessions,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  // Meeting URLs/codes can contain access secrets; accommodation locations and notes may disclose participant information.
  // None belongs in the member-wide catalogue. Enrolled members need a separately governed registration-scoped view.
  staffOnlyResponseFields: ['virtualMeetingUrl', 'virtualMeetingAccessCode', 'accommodationHotel', 'notes'],
  // Budget and actual cost remain confidential for every generic caller until a finance-specific read mandate is issued.
  // Do not equate the steward floor with institutional financial authority.
  omitFromResponse: ['sessionBudget', 'actualCost'],
  writeRole: 'steward',
  // Counters, rates, ratings, cost and lifecycle come from registrations, attendance, evaluations and finance, not from a steward's body.
  writableFields: [
    'courseId', 'sessionCode', 'sessionName', 'startDate', 'endDate', 'sessionTimes', 'deliveryMethod', 'venueName', 'venueAddress', 'roomNumber',
    'virtualMeetingUrl', 'virtualMeetingAccessCode', 'leadInstructorId', 'leadInstructorName', 'coInstructors', 'registrationOpenDate',
    'registrationCloseDate', 'maxEnrollment', 'travelSubsidyOffered', 'accommodationArranged', 'accommodationHotel', 'notes',
  ],
  beforeCreate: async (values, { organizationId }) => {
    if (!organizationId) throw ApiError.forbidden('Organization membership required');
    validateEducationSessionCreate(values);
    await assertOrganizationOwns([{ field: 'courseId', value: values.courseId, table: trainingCourses }], organizationId);
    return values;
  },
});
export { GET, POST };
