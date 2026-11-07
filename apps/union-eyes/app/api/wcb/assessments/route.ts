/**
 * WCB Employer Assessments — Collection CRUD
 *
 * GET  /api/wcb/assessments — list WCB assessments for the org
 * POST /api/wcb/assessments — create a new assessment (officer+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { wcbEmployerAssessments } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: wcbEmployerAssessments,
  pk: 'id',
  tags: ['WCB'],
  orgScoped: true,
  // Premium rate, assessable payroll and premium due are the organization's financial position: an officer reads them.
  readRole: 'officer',
  writeRole: 'officer',
  // The assessment as the board issued it (no screen posts here). Payment date and status are recorded when it is paid, not
  // in the create body.
  writableFields: [
    'jurisdiction', 'assessmentYear', 'rateGroup', 'premiumRate', 'assessablePayroll', 'premiumDue', 'experienceRating',
    'ratingProgramName', 'surchargeOrRefund', 'dueDate',
  ],
});
export { GET, POST };
