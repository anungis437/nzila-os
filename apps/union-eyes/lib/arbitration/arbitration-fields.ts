/**
 * The body fields the generic arbitration routes accept (DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT). organizationId, id and the timestamps are
 * server-owned; the grievance is fixed at creation; the arbitration number is the record's identifier and is not renumbered afterwards.
 * Every write is additionally gated by the case authority (mayWriteArbitrationFor), so the procedural status, the award and the costs are
 * recorded only by someone who holds or may edit the case. arbitratorIds is left out: nothing checks that the ids it names belong to the
 * caller's organization, so the names are recorded instead.
 */
const PROCEEDING_FIELDS = [
  'boardName', 'boardType',
  'arbitratorNames', 'unionAppointee', 'employerAppointee', 'chairAppointee',
  'scheduledDate', 'location', 'virtualMeetingUrl',
  'submissionDeadline', 'evidenceDeadline', 'replyDeadline', 'awardDeadline',
  'unionCostShare', 'employerCostShare', 'estimatedCost',
  'submissions', 'exhibits',
] as const;

export const ARBITRATION_CREATE_FIELDS: readonly string[] = ['grievanceId', 'arbitrationNumber', ...PROCEEDING_FIELDS];

export const ARBITRATION_UPDATE_FIELDS: readonly string[] = [
  ...PROCEEDING_FIELDS,
  'status', 'hearingDays', 'hearingDates', 'adjournedTo',
  'awardDate', 'award', 'awardSummary', 'actualCost',
];
