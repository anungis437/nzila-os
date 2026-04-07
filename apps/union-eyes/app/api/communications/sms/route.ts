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
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
