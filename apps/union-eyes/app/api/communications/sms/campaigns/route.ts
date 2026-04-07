/**
 * CRUD collection route for SMS campaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { smsCampaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: smsCampaigns,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
