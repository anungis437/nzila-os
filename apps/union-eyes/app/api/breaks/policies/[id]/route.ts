/**
 * Break Policies — Item CRUD
 *
 * GET    /api/breaks/policies/:id — get a single break policy
 * PATCH  /api/breaks/policies/:id — update a break policy
 * DELETE /api/breaks/policies/:id — delete a break policy
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { breakPolicies } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: breakPolicies,
  pk: 'id',
  tags: ["Breaks"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
