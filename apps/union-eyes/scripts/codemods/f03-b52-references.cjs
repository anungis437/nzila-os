const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}

// Sessions: the course must be the organization's own, and registration, attendance, completion and rating figures are not body-writable.
edit('app/api/education/sessions/route.ts', [
  [
    "import { courseSessions } from '@/db/schema';\n",
    "import { courseSessions, trainingCourses } from '@/db/schema';\nimport { assertOrganizationOwns } from '@/lib/api/org-references';\n",
  ],
  [
    "  writeRole: 'steward',\n});",
    "  writeRole: 'steward',\n  // Counters, rates, ratings, cost and lifecycle come from registrations, attendance, evaluations and finance, not from a steward's body.\n  writableFields: [\n    'courseId', 'sessionCode', 'sessionName', 'startDate', 'endDate', 'sessionTimes', 'deliveryMethod', 'venueName', 'venueAddress', 'roomNumber',\n    'virtualMeetingUrl', 'virtualMeetingAccessCode', 'leadInstructorId', 'leadInstructorName', 'coInstructors', 'registrationOpenDate',\n    'registrationCloseDate', 'maxEnrollment', 'travelSubsidyOffered', 'accommodationArranged', 'accommodationHotel', 'notes',\n  ],\n  beforeCreate: async (values, { organizationId }) => {\n    await assertOrganizationOwns([{ field: 'courseId', value: values.courseId, table: trainingCourses }], organizationId);\n    return values;\n  },\n});",
  ],
])

// Employer communications: the employer, grievance, contact and template must be the organization's own, and the list is bounded.
edit('app/api/employers/communications/route.ts', [
  [
    "import { eq, desc, and } from 'drizzle-orm'\n",
    "import { eq, desc, and } from 'drizzle-orm'\nimport { assertOrganizationOwns } from '@/lib/api/org-references'\nimport { ApiError } from '@/lib/api/errors'\nimport { employers } from '@/db/schema/union-structure-schema'\nimport { employerContacts } from '@/db/schema/domains/communications/employer-communications'\nimport { grievances } from '@/db/schema/domains/claims/grievances'\nimport { messageTemplates } from '@/db/schema/domains/communications/campaigns'\n",
  ],
  [
    "    const data = parsed.data\n\n    // The communication record",
    "    const data = parsed.data\n\n    // Every id in the body must name a row of the caller's own organization.\n    await assertOrganizationOwns([\n      { field: 'employerId', value: data.employerId, table: employers },\n      { field: 'grievanceId', value: data.grievanceId, table: grievances },\n      { field: 'recipientContactId', value: data.recipientContactId, table: employerContacts },\n      { field: 'templateId', value: data.templateId, table: messageTemplates },\n    ], organizationId)\n\n    // The communication record",
  ],
  [
    "  } catch (_error) {\n    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to log communication')",
    "  } catch (error) {\n    if (error instanceof ApiError) {\n      return standardErrorResponse(error.code, error.message)\n    }\n    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to log communication')",
  ],
  ["      .orderBy(desc(employerCommunications.createdAt))\n\n    return standardSuccessResponse(rows)", "      .orderBy(desc(employerCommunications.createdAt))\n      .limit(200)\n\n    return standardSuccessResponse(rows)"],
])
