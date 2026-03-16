/**
 * CRUD collection route for messages
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { messages } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: messages,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
