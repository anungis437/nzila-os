/**
 * CRUD collection route for notifications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { notifications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: notifications,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
