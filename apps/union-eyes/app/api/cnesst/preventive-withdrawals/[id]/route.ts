/**
 * Preventive Withdrawals — Item CRUD
 *
 * GET    /api/cnesst/preventive-withdrawals/:id
 * PATCH  /api/cnesst/preventive-withdrawals/:id
 * DELETE /api/cnesst/preventive-withdrawals/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { preventiveWithdrawals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: preventiveWithdrawals,
  pk: 'id',
  tags: ['CNESST', 'Preventive Withdrawal'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
