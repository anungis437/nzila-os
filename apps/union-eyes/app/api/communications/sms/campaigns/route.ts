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
  // Message content, recipients and member phone numbers: officer authority, never a member or steward floor.
  readRole: 'officer',
  writeRole: 'officer',
});
export { GET, POST };
