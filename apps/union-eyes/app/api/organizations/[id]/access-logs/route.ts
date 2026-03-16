/**
 * CRUD item route for organizations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: organizations,
  pk: 'id',
  tags: ["Organizations"],
  orgScoped: false,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
