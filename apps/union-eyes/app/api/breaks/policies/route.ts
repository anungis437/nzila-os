/**
 * Break Policies — Collection CRUD
 *
 * GET  /api/breaks/policies — list break policies for the org
 * POST /api/breaks/policies — create a new break policy (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { breakPolicies } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: breakPolicies,
  pk: 'id',
  tags: ["Breaks"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
