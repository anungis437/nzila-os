/**
 * CRUD collection route for remittanceApprovals
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { remittanceApprovals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: remittanceApprovals,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
