/**
 * GET /api/dues/ledger — Query dues ledger entries for the org
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { getLedgerEntries } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'financial_intelligence_suite',
    openapi: {
      tags: ['Dues'],
      summary: 'List dues ledger entries for the organization',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const billingPeriodId = url.searchParams.get('billingPeriodId') ?? undefined;
    const costType = (url.searchParams.get('costType') as Parameters<typeof getLedgerEntries>[0]['costType']) ?? undefined;
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const entries = await getLedgerEntries({
      organizationId,
      billingPeriodId,
      costType,
      limit,
      offset,
    });
    return { entries };
  },
);
