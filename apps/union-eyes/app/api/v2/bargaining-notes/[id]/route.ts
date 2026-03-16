/**
 * CRUD item route for bargainingNotes
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingNotes } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: bargainingNotes,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
