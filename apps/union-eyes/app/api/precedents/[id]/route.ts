/**
 * CRUD item route for arbitrationPrecedents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrationPrecedents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: arbitrationPrecedents,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
