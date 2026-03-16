/**
 * CRUD item route for pendingProfilesTable
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pendingProfilesTable } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: pendingProfilesTable,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'member',
});
export { GET, PATCH, DELETE };
