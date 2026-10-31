/**
 * CRUD item route for distribution lists
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { newsletterDistributionLists } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: newsletterDistributionLists,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  itemRoute: true,
  // A removed template or list takes its history with it (a list's subscribed and unsubscribed trail cascades); it is retained.
  retainOnDelete: true,
  // A distribution list names its audience and carries its filter criteria: staff read it.
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
