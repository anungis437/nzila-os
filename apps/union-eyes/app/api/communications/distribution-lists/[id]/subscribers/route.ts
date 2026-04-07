/**
 * CRUD item route for distribution list subscribers
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { newsletterListSubscribers } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: newsletterListSubscribers,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
