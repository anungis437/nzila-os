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
  readRole: 'steward',
  writeRole: 'officer',
});
export { GET, PATCH, DELETE };
