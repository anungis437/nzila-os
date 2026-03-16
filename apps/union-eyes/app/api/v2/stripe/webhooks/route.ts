/**
 * CRUD collection route for stripeConnectAccounts
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { stripeConnectAccounts } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: stripeConnectAccounts,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
