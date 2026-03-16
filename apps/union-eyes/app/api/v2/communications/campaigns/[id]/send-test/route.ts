/**
 * CRUD item route for campaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { campaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: campaigns,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
