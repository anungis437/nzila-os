/**
 * CRUD collection route for organizingCampaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizingCampaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: organizingCampaigns,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
