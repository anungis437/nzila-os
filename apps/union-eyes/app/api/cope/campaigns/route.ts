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
  // The amount raised, the status and the payment-provider identifiers come from recorded donations and the provider, never from a steward's body.
  writableFields: ['title', 'slug', 'description', 'campaignType', 'goalAmount', 'currency', 'startDate', 'endDate', 'allowRecurring', 'suggestedAmounts', 'thankYouMessage'],
});
export { GET, POST };
