/**
 * CRUD item route for inAppNotifications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { inAppNotifications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: inAppNotifications,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
