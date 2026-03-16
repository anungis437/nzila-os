/**
 * CRUD collection route for donationCampaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { donationCampaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: donationCampaigns,
  pk: 'id',
  tags: ["Billing"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
