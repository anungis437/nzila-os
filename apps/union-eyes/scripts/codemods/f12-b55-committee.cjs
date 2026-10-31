const fs = require('fs')
function edit(p, pairs) {
  let s = fs.readFileSync(p, 'utf8')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error('missing in ' + p + ': ' + a.slice(0, 80))
    s = s.split(a).join(b)
  }
  fs.writeFileSync(p, s)
}

// Approved minutes close the record of the meeting: its decisions, agenda and status are not rewritten afterwards.
edit('lib/services/committee-workspace-service.ts', [
  [
    "  return withRLSContext(async (tx) => {\n    const [updated] = await tx\n      .update(committeeMeetings)\n      .set({ ...changes, updatedAt: sql`now()` })\n      .where(and(eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)))\n      .returning();\n    if (!updated) return null;",
    "  // Once the minutes are approved, the recorded decisions, the agenda and the meeting status are part of the approved record.\n  const touchesApprovedRecord = (['decisions', 'agendaItems', 'agenda', 'status'] as const).some((key) => key in changes);\n  return withRLSContext(async (tx) => {\n    const conditions = [eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)];\n    if (touchesApprovedRecord) conditions.push(isNull(committeeMeetings.minutesApprovedAt));\n    const [updated] = await tx\n      .update(committeeMeetings)\n      .set({ ...changes, updatedAt: sql`now()` })\n      .where(and(...conditions))\n      .returning();\n    if (!updated) {\n      if (!touchesApprovedRecord) return null;\n      const [exists] = await tx\n        .select({ id: committeeMeetings.id })\n        .from(committeeMeetings)\n        .where(and(eq(committeeMeetings.id, meetingId), eq(committeeMeetings.organizationId, organizationId)));\n      if (exists) throw ApiError.conflict('The decisions, agenda and status of a meeting with approved minutes cannot be changed');\n      return null;\n    }",
  ],
])

// The person who last edited the meeting record (which includes recording the minutes) does not approve them.
edit('app/api/committees/[id]/meetings/[meetingId]/minutes/route.ts', [
  [
    "    const updated = await approveMinutes(meetingId, organizationId, userId!);",
    "    if (meeting.updatedBy && meeting.updatedBy === userId) {\n      throw ApiError.forbidden(\"Minutes cannot be approved by the person who last edited the meeting record\");\n    }\n\n    const updated = await approveMinutes(meetingId, organizationId, userId!);",
  ],
])

// Members named in attendance and as an action-item assignee must belong to the organization; a linked document must be its own.
edit('app/api/committees/[id]/meetings/[meetingId]/attendance/route.ts', [
  ["import { ApiError } from \"@/lib/api/errors\";\n", "import { ApiError } from \"@/lib/api/errors\";\nimport { assertOrganizationMembers } from \"@/lib/services/org-member-references\";\n"],
])
edit('app/api/committees/[id]/action-items/route.ts', [
  ["import { ApiError } from \"@/lib/api/errors\";\n", "import { ApiError } from \"@/lib/api/errors\";\nimport { assertOrganizationMembers } from \"@/lib/services/org-member-references\";\n"],
  ["    await requireCommitteeScope(organizationId, committeeId, { meetingId: body.meetingId });\n\n    return createActionItem({", "    await requireCommitteeScope(organizationId, committeeId, { meetingId: body.meetingId });\n    await assertOrganizationMembers([body.assignedTo], organizationId);\n\n    return createActionItem({"],
])
edit('app/api/committees/[id]/documents/route.ts', [
  ["import { ApiError } from \"@/lib/api/errors\";\n", "import { ApiError } from \"@/lib/api/errors\";\nimport { assertOrganizationOwns } from \"@/lib/api/org-references\";\nimport { documents } from \"@/db/schema/documents-schema\";\n"],
  ["    await requireCommitteeScope(organizationId, committeeId, { meetingId: body.meetingId });\n\n    return linkDocument({", "    await requireCommitteeScope(organizationId, committeeId, { meetingId: body.meetingId });\n    await assertOrganizationOwns([{ field: 'documentId', value: body.documentId, table: documents }], organizationId);\n\n    return linkDocument({"],
])
edit('app/api/committees/[id]/meetings/[meetingId]/attendance/route.ts', [
  ['    await recordAttendance(meetingId, organizationId, body.attendees, userId ?? undefined);', '    await assertOrganizationMembers(body.attendees.map((a) => a.memberId), organizationId);\n    await recordAttendance(meetingId, organizationId, body.attendees, userId ?? undefined);'],
])
