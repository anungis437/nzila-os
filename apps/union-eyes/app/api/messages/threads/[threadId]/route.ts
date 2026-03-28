/**
 * CRUD item route for a single message thread
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { messageThreads } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: messageThreads,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
