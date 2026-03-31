/**
 * Anti-Scab Violations — Item CRUD
 *
 * GET    /api/cnesst/anti-scab/:id
 * PATCH  /api/cnesst/anti-scab/:id
 * DELETE /api/cnesst/anti-scab/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { antiScabViolations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: antiScabViolations,
  pk: 'id',
  tags: ['CNESST', 'Anti-Scab'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
