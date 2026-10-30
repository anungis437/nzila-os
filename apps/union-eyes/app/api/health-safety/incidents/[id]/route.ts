/**
 * CRUD item route for workplaceIncidents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { workplaceIncidents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: workplaceIncidents,
  tags: ["Health-safety"],
  orgScoped: true,
  itemRoute: true,
  // The collection already requires health_safety_rep: an incident row carries the narrative, injury details,
  // witnesses and reporter contact, so the item read matches it instead of the member floor.
  readRole: 'health_safety_rep',
  writeRole: 'admin',
  // A status or outcome is the result of the workflow that investigates, verifies or closes the record, so a generic PATCH may not set it.
  blockedPatchFields: ['status', 'closedDate', 'investigationStartDate', 'investigationCompletedDate', 'investigationReport', 'wsibClaimStatus'],
});
export { GET, PATCH, DELETE };
