/**
 * Pay Equity Exercises — Collection CRUD
 *
 * Loi sur l'équité salariale: initial and maintenance exercises
 *
 * GET  /api/cnesst/pay-equity — list exercises for the org
 * POST /api/cnesst/pay-equity — create a new exercise (officer+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { payEquityExercises } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: payEquityExercises,
  pk: 'id',
  tags: ['CNESST', 'Pay Equity'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'officer',
});
export { GET, POST };
