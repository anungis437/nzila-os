/**
 * Right of Refusal Events — Item CRUD
 *
 * GET    /api/cnesst/right-of-refusal/:id
 * PATCH  /api/cnesst/right-of-refusal/:id
 * DELETE /api/cnesst/right-of-refusal/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { rightOfRefusalEvents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: rightOfRefusalEvents,
  pk: 'id',
  tags: ['CNESST', 'Right of Refusal'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
