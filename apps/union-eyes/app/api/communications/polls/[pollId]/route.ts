/**
 * CRUD item route for polls (the path segment is [pollId]; this file used to mount the collection handlers, so no poll could be read, changed or removed by id)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { lifecycleBeforeUpdate } from '@/lib/communications/lifecycle';
import { polls } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: polls,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  itemRoute: true,
  paramName: 'pollId',
  readRole: 'member',
  writeRole: 'steward',
  blockedPatchFields: ['publishedAt', 'totalVotes', 'uniqueVoters'],
  beforeUpdate: lifecycleBeforeUpdate('poll'),
});
export { GET, PATCH, DELETE };
