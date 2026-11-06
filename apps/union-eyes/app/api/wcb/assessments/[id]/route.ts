/**
 * WCB Employer Assessments — Item CRUD
 *
 * GET    /api/wcb/assessments/:id — get a single assessment
 * PATCH  /api/wcb/assessments/:id — update an assessment
 * DELETE /api/wcb/assessments/:id — delete an assessment
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { wcbEmployerAssessments } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: wcbEmployerAssessments,
  pk: 'id',
  tags: ['WCB'],
  orgScoped: true,
  itemRoute: true,
  // Premium rate, assessable payroll and premium due are the organization's financial position: an officer reads them.
  readRole: 'officer',
  writeRole: 'officer',
  // Corrections to the assessment's figures. The jurisdiction and year identify it and do not change; status and payment date
  // are not set through the generic PATCH.
  writableFields: [
    'rateGroup', 'premiumRate', 'assessablePayroll', 'premiumDue', 'experienceRating', 'ratingProgramName', 'surchargeOrRefund',
    'dueDate',
  ],
});
export { GET, PATCH, DELETE };
