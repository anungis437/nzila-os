/**
 * Preventive Withdrawals — Collection CRUD
 *
 * LSST art. 40–48: retrait préventif (pregnancy / breastfeeding / hazardous)
 *
 * GET  /api/cnesst/preventive-withdrawals — list for the org
 * POST /api/cnesst/preventive-withdrawals — record a new withdrawal (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { preventiveWithdrawals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: preventiveWithdrawals,
  pk: 'id',
  tags: ['CNESST', 'Preventive Withdrawal'],
  orgScoped: true,
  ownerColumn: 'workerId',
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
