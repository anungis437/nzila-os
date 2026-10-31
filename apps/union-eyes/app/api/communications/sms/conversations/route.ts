/**
 * CRUD collection route for SMS conversations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { recordsASendOnly } from '@/lib/api/records-a-send-only';
import { smsConversations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: smsConversations,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  // Message content, recipients and member phone numbers: officer authority, never a member or steward floor.
  readRole: 'officer',
  writeRole: 'officer',
});
// The rows record a send (status, provider id, price, delivery times) and this route sends nothing, so it creates none.
export const POST = recordsASendOnly('Create an SMS conversation record (not implemented)', 'SMS conversations');
export { GET };
