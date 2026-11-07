/**
 * Right of Refusal Events — Collection CRUD
 *
 * LSST art. 12–31: right of a worker to refuse dangerous work
 *
 * GET  /api/cnesst/right-of-refusal — list events for the org
 * POST /api/cnesst/right-of-refusal — record a new refusal (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { rightOfRefusalEvents } from '@/db/schema';
import { assertOhsCaseAccessForCreate, linkedOhsRecordRowReadable } from '@/lib/services/ohs-case-access';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: rightOfRefusalEvents,
  pk: 'id',
  tags: ['CNESST', 'Right of Refusal'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
  // A steward reads a refusal only when case authority reaches its member, directly or through the filing it is linked to (DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY).
  rowReadAuthority: linkedOhsRecordRowReadable,
  // Recording a refusal for a member a steward holds no case authority over is refused before any row is inserted.
  beforeCreate: async (values, { organizationId, userId }) => {
    await assertOhsCaseAccessForCreate({ organizationId, actorUserId: userId, memberId: values.memberId, linkedCneesstFilingId: values.cneesstFilingId });
    return values;
  },
  // The refusal as reported, and the filing it arose from when there is one (the source of its own case authority for a
  // steward outside the ordinary coverage, see ohs-case-access.ts). The inspector's decision (the outcome enum) and
  // corrective actions are not create fields, but the inspector's decision date and a steward's own outcome notes are
  // narrative/fact fields a steward may record at any point, not an authority-gated decision. memberId is required by the table.
  writableFields: [
    'memberId', 'memberName', 'jobTitle', 'refusalDate', 'workplaceName', 'locationDescription', 'taskRefused',
    'dangerDescription', 'supervisorNotifiedAt', 'supervisorName', 'hsRepNotifiedAt', 'hsRepName', 'cneesstInspectorCalledAt',
    'cneesstInspectorName', 'inspectorDecisionDate', 'outcomeNotes', 'cneesstFilingId',
  ],
});
export { GET, POST };
