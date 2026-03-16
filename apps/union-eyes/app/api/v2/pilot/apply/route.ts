/**
 * CRUD collection route for pendingProfilesTable
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pendingProfilesTable } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: pendingProfilesTable,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'member',
});
export { GET, POST };
