/**
 * CRUD item route for surveys
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { surveys } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: surveys,
  pk: 'id',
  tags: ["Surveys"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
