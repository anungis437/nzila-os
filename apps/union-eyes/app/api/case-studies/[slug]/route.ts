/**
 * CRUD item route for grievances
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { grievances } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: grievances,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
