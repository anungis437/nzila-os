/**
 * CRUD collection route for externalAccounts
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { externalAccounts } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: externalAccounts,
  pk: 'id',
  tags: ["Finance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
