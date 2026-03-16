/**
 * CRUD item route for messageThreads
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { messageThreads } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: messageThreads,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
