/**
 * CRUD item route for dataClassificationPolicy
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { dataClassificationPolicy } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: dataClassificationPolicy,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, PATCH, DELETE };
