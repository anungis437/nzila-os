/**
 * CRUD item route for stewardAssignments
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { stewardAssignments } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: stewardAssignments,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
