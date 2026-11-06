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
  readRole: 'officer',
  writeRole: 'officer',
  // The campaign's plan. Status, card and contact counters, filing/election/certification dates, votes and the election result are
  // outcomes recorded as the campaign proceeds; the lead organizer and team are people, not taken from a body here.
  writableFields: ['campaignName', 'campaignCode', 'targetEmployer', 'workplaceLocation', 'industry', 'campaignType', 'priority', 'estimatedUnitSize', 'targetCardCount', 'campaignStartDate', 'targetCardDeadline', 'organizingStrategy', 'keyIssues', 'employerVulnerabilities', 'unionAdvantages'],
});
export { GET, POST };
