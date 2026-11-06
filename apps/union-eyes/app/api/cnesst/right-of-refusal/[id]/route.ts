/**
 * Right of Refusal Events — Item CRUD
 *
 * GET    /api/cnesst/right-of-refusal/:id
 * PATCH  /api/cnesst/right-of-refusal/:id
 * DELETE /api/cnesst/right-of-refusal/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { rightOfRefusalEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: rightOfRefusalEvents,
  pk: 'id',
  tags: ['CNESST', 'Right of Refusal'],
  orgScoped: true,
  itemRoute: true,
  retainOnDelete: true,
  readRole: 'steward',
  writeRole: 'steward',
  // Notification facts and the narrative a steward completes, including the outcome notes once the matter is resolved. The member,
  // refusal date, the outcome enum itself and corrective actions are not changed through the generic PATCH.
  writableFields: [
    'jobTitle', 'workplaceName', 'locationDescription', 'taskRefused', 'dangerDescription', 'supervisorNotifiedAt',
    'supervisorName', 'hsRepNotifiedAt', 'hsRepName', 'cneesstInspectorCalledAt', 'cneesstInspectorName', 'reprisalComplaint',
    'reprisalDetails', 'outcomeNotes',
  ],
});
export { GET, PATCH, DELETE };
