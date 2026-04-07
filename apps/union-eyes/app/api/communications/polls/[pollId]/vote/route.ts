/**
 * CRUD collection route for poll votes
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pollVotes } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: pollVotes,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
