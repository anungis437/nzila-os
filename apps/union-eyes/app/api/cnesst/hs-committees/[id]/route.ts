/**
 * Joint H&S Committees — Item CRUD
 *
 * GET    /api/cnesst/hs-committees/:id
 * PATCH  /api/cnesst/hs-committees/:id
 * DELETE /api/cnesst/hs-committees/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { jointHsCommittees } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: jointHsCommittees,
  pk: 'id',
  tags: ['CNESST', 'H&S Committee'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'officer',
});
export { GET, PATCH, DELETE };
