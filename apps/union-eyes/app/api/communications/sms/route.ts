/**
 * CRUD collection route for SMS messages
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { recordsASendOnly } from '@/lib/api/records-a-send-only';
import { smsMessages } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: smsMessages,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  // Message content, recipients and member phone numbers: officer authority, never a member or steward floor.
  readRole: 'officer',
  writeRole: 'officer',
});
// The rows record a send (status, provider id, price, delivery times) and this route sends nothing, so it creates none.
export const POST = recordsASendOnly('Create an SMS message record (not implemented)', 'SMS messages');
export { GET };
