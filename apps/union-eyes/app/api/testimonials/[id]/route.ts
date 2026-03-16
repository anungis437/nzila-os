/**
 * CRUD item route for publicContent
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { publicContent } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: publicContent,
  pk: 'id',
  tags: ["Content"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
