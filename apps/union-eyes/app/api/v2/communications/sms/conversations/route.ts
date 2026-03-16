/**
 * CRUD collection route for campaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { campaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: campaigns,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
