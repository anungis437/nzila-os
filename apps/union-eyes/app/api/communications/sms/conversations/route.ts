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
  // Message content, recipients and member phone numbers: officer authority, never a member or steward floor.
  readRole: 'officer',
  writeRole: 'officer',
});
export { GET, POST };
