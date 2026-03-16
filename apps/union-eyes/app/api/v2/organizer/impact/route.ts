/**
 * CRUD collection route for organizerTasks
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizerTasks } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: organizerTasks,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
