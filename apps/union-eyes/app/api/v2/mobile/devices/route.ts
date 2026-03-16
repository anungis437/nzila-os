/**
 * CRUD collection route for pushDevices
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pushDevices } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: pushDevices,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
