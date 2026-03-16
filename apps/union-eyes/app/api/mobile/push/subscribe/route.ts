/**
 * CRUD collection route for pushNotifications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pushNotifications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: pushNotifications,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
