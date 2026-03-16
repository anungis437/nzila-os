/**
 * CRUD collection route for dataClassificationPolicy
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { dataClassificationPolicy } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: dataClassificationPolicy,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
