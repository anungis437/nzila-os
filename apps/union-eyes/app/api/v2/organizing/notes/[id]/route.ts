/**
 * CRUD item route for organizingCampaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizingCampaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: organizingCampaigns,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
