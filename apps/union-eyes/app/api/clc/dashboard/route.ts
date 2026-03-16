/**
 * CRUD collection route for clcSyncLog
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { clcSyncLog } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: clcSyncLog,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
