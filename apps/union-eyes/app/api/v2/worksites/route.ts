/**
 * CRUD collection route for worksites
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { worksites } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: worksites,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
