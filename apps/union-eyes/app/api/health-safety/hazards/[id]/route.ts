/**
 * CRUD item route for hazardReports
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ne } from 'drizzle-orm';
import { hazardReports } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: hazardReports,
  tags: ["Health-safety"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'health_safety_rep',
  // A record an administrator removed is archived, and an archived record is neither listed nor returned by id.
  readCondition: ne(hazardReports.status, 'archived'),
  writeRole: 'admin',
  // A status or outcome is the result of the workflow that investigates, verifies or closes the record, so a generic PATCH may not set it.
  // The report number is server-issued at creation and never changed afterwards.
  blockedPatchFields: ['reportNumber', 'status', 'closedDate', 'verifiedById', 'verifiedByName', 'verifiedDate', 'riskAssessmentCompleted', 'likelihoodScore', 'severityScore', 'riskScore'],
});
export { GET, PATCH, DELETE };
