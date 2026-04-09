/**
 * CRUD collection route for arbitrations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { arbitrations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: arbitrations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
