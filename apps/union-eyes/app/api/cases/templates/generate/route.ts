/**
 * CRUD collection route for grievances
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { grievances } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: grievances,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  entitlement: 'grievance_case_suite',
});
export { GET, POST };
