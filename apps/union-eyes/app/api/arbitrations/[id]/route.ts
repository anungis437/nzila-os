/**
 * CRUD item route for arbitrations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: arbitrations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
