/**
 * CRUD item route for claims
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { claims } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: claims,
  pk: 'claimId',
  tags: ["Claims"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
