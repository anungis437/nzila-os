/**
 * WCB Claims — Item CRUD
 *
 * GET    /api/wcb/claims/:id — get a single claim
 * PATCH  /api/wcb/claims/:id — update a claim
 * DELETE /api/wcb/claims/:id — delete a claim
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { wcbClaims } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: wcbClaims,
  pk: 'id',
  tags: ['WCB'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
