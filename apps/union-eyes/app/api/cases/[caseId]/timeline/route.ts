/**
 * CRUD collection route for grievanceTimeline
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { grievanceTimeline } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: grievanceTimeline,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  entitlement: 'grievance_case_suite',
});
export { GET, POST };
