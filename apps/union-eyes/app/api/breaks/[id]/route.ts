/**
 * Member Breaks — Item CRUD
 *
 * GET    /api/breaks/:id — get a single break record
 * PATCH  /api/breaks/:id — update a break record
 * DELETE /api/breaks/:id — delete a break record
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { memberBreaks } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: memberBreaks,
  pk: 'id',
  tags: ["Breaks"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'member',
});
export { GET, PATCH, DELETE };
