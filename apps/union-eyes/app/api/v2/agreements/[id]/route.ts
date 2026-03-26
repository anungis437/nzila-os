/**
 * CRUD item route for a single collective bargaining agreement
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { collectiveAgreements } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: collectiveAgreements,
  pk: 'id',
  tags: ['Agreements'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
