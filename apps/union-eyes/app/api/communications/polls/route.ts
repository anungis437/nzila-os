/**
 * CRUD collection route for polls
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { polls } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: polls,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  writableFields: ['question', 'description', 'options', 'allowMultipleVotes', 'requireAuthentication', 'showResultsBeforeVote', 'closesAt'],
});
export { GET, POST };
