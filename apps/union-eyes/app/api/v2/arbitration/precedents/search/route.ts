/**
 * CRUD collection route for arbitrationDecisions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrationDecisions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: arbitrationDecisions,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
