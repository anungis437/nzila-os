/**
 * CRUD collection route for federations
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { federations } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: federations,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
