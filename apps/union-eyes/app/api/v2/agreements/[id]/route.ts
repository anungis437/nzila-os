/**
 * CRUD item route for a single collective bargaining agreement
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { collectiveAgreements } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PUT, DELETE } = crudRoutes({
  table: collectiveAgreements,
  pk: 'id',
  tags: ['Agreements'],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PUT, DELETE };
