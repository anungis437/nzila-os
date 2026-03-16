/**
 * CRUD collection route for votingSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { votingSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: votingSessions,
  pk: 'id',
  tags: ["Governance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
