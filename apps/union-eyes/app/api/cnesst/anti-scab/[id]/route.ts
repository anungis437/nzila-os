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
  retainOnDelete: true,
  readRole: 'steward',
  writeRole: 'steward',
  // Authorship and the reporter are fixed when the violation is filed.
  blockedPatchFields: ['createdBy', 'reportedById', 'reportedByName'],
});
export { GET, PATCH, DELETE };
