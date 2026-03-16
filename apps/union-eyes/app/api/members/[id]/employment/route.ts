/**
 * CRUD item route for memberEmployment
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { memberEmployment } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: memberEmployment,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
