/**
 * CRUD item route for safetyInspections
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { safetyInspections } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: safetyInspections,
  tags: ["Health-safety"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'admin',
  // A status or outcome is the result of the workflow that investigates, verifies or closes the record, so a generic PATCH may not set it.
  blockedPatchFields: ['status', 'completedDate', 'itemsPassed', 'scorePercentage', 'followUpCompleted'],
});
export { GET, PATCH, DELETE };
