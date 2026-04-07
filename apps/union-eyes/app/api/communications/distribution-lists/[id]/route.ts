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
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
