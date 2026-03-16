/**
 * CRUD item route for organizationRelationships
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizationRelationships } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: organizationRelationships,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
