/**
 * CRUD collection route for courseSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { courseSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: courseSessions,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
