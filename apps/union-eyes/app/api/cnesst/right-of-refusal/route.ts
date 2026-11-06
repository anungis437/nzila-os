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
  // The refusal as reported. The inspector's decision, outcome, corrective actions, reprisal complaint, documents and the uuid
  // links (workplace, incident, filing) are not create fields. memberId is required by the table.
  writableFields: [
    'memberId', 'memberName', 'jobTitle', 'refusalDate', 'workplaceName', 'locationDescription', 'taskRefused',
    'dangerDescription', 'supervisorNotifiedAt', 'supervisorName', 'hsRepNotifiedAt', 'hsRepName', 'cneesstInspectorCalledAt',
    'cneesstInspectorName',
  ],
});
export { GET, POST };
