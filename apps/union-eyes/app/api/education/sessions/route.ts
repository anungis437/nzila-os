/**
 * CRUD collection route for courseSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { courseSessions, trainingCourses } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';

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
    await assertOrganizationOwns([{ field: 'courseId', value: values.courseId, table: trainingCourses }], organizationId);
    return values;
  },
});
export { GET, POST };
