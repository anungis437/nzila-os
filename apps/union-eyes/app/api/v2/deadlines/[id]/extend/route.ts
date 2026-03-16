/**
 * CRUD item route for deadlines
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { deadlines } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: deadlines,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
