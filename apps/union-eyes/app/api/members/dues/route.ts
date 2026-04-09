/**
 * CRUD collection route for duesTransactions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { duesTransactions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: duesTransactions,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  entitlement: 'financial_intelligence_suite',
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
