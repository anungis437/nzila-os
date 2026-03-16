/**
 * CRUD collection route for inAppNotifications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { inAppNotifications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: inAppNotifications,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
