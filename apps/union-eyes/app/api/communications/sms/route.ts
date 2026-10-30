/**
 * CRUD collection route for SMS messages
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { smsMessages } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: smsMessages,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  // Message content, recipients and member phone numbers: officer authority, never a member or steward floor.
  readRole: 'officer',
  writeRole: 'officer',
});
export { GET, POST };
