/**
 * CRUD item route for arbitrationDecisions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrationDecisions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: arbitrationDecisions,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
