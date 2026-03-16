/**
 * CRUD collection route for stewardAssignments
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { stewardAssignments } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: stewardAssignments,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
