/**
 * CRUD collection route for committees
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { committees } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: committees,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
