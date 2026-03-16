/**
 * CRUD collection route for profilesTable
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { profilesTable } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: profilesTable,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
