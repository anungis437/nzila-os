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

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: rightOfRefusalEvents,
  pk: 'id',
  tags: ['CNESST', 'Right of Refusal'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
  // The refusal as reported. The inspector's decision (the outcome enum) and corrective actions are not create fields, but the
  // inspector's decision date and a steward's own outcome notes are narrative/fact fields a steward may record at any point, not
  // an authority-gated decision. memberId is required by the table.
  writableFields: [
    'memberId', 'memberName', 'jobTitle', 'refusalDate', 'workplaceName', 'locationDescription', 'taskRefused',
    'dangerDescription', 'supervisorNotifiedAt', 'supervisorName', 'hsRepNotifiedAt', 'hsRepName', 'cneesstInspectorCalledAt',
    'cneesstInspectorName', 'inspectorDecisionDate', 'outcomeNotes',
  ],
});
export { GET, POST };
