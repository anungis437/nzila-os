/**
 * CRUD item route for reports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { reports } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: reports,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  entitlement: 'export_suite',
});
export { GET, PATCH, DELETE };
