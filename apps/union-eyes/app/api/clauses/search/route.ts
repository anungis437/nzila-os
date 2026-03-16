/**
 * CRUD collection route for cbaClause
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { cbaClause } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: cbaClause,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
