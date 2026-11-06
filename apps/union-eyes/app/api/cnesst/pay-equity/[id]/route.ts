/**
 * Pay Equity Exercises — Item CRUD
 *
 * GET    /api/cnesst/pay-equity/:id
 * PATCH  /api/cnesst/pay-equity/:id
 * DELETE /api/cnesst/pay-equity/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { payEquityExercises } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: payEquityExercises,
  pk: 'id',
  tags: ['CNESST', 'Pay Equity'],
  orgScoped: true,
  itemRoute: true,
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
export { GET, PATCH, DELETE };
