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
  // Members receive a public session projection; verified tenant staff can inspect access details and financials.
  // An absent or failed role lookup redacts these fields, including POST responses.
  staffOnlyResponseFields: ['virtualMeetingAccessCode', 'sessionBudget', 'actualCost'],
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
