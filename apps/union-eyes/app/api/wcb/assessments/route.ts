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
  readRole: 'steward',
  writeRole: 'officer',
});
export { GET, POST };
