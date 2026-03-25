/**
 * GET /api/dues/balance — Get dues balance summary for the org
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { getLedgerSummary } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Dues'],
      summary: 'Get dues balance summary for the organization',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const summary = await getLedgerSummary({ organizationId });
    return { ...summary };
  },
);
