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
  // The exercise's committee and job-class facts. Status, the adjustment amount and payment date, the CNESST declaration and
  // documents are not set through the generic route.
  writableFields: [
    'exerciseType', 'committeeFormed', 'committeeFormationDate', 'workerMembers', 'employerMembers', 'maleJobClasses',
    'femaleJobClasses', 'mixedJobClasses', 'evaluationMethod', 'resultsPostedDate', 'contestDeadline',
    'maintenanceEvaluationDate', 'nextMaintenanceDue', 'notes',
  ],
});
export { GET, POST };
