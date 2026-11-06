/**
 * CRUD collection route for organizingCampaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { organizingCampaigns } from '@/db/schema';
import { ApiError } from '@/lib/api/errors';
import { issueOrganizationRecordNumber } from '@/lib/records/organization-record-number';

export const dynamic = 'force-dynamic';

/**
 * The facts of a campaign only the organizer knows: none has a default the server could honestly supply, so each must be
 * present, and a body without one is a 400 that names it instead of a NOT NULL failure inside the insert.
 */
export function assertCampaignCreateFacts(values: Record<string, unknown>): void {
  const missing: string[] = [];
  for (const field of ['campaignName', 'targetEmployer', 'workplaceLocation'] as const) {
    if (typeof values[field] !== 'string' || (values[field] as string).trim() === '') missing.push(field);
  }
  const size = values.estimatedUnitSize;
  if (typeof size !== 'number' || !Number.isInteger(size) || size < 1) missing.push('estimatedUnitSize (a whole number of at least 1)');
  if (missing.length > 0) throw ApiError.badRequest(`Required to create a campaign: ${missing.join(', ')}`);
}

const { GET, POST } = crudRoutes({
  table: organizingCampaigns,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'officer',
  writeRole: 'officer',
  // The campaign code is the server's: a body that names one is refused (400), and the next code in this organization's
  // CMP-<year>- sequence is issued in the transaction that inserts the row, so another organization's codes are never read.
  blockedPatchFields: ['campaignCode'],
  beforeCreate: async (values, ctx) => {
    assertCampaignCreateFacts(values);
    return { ...values, campaignCode: await issueOrganizationRecordNumber('organizingCampaign', ctx.organizationId) };
  },
});
export { GET, POST };
