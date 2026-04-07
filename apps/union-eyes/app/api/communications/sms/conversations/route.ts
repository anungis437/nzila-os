/**
 * CRUD collection route for SMS conversations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { smsConversations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: smsConversations,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
