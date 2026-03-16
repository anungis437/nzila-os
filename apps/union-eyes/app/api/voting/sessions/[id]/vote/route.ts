/**
 * CRUD item route for votingSessions
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { votingSessions } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: votingSessions,
  pk: 'id',
  tags: ["Governance"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
