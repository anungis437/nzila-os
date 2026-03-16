/**
 * CRUD collection route for employers
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { employers } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: employers,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
