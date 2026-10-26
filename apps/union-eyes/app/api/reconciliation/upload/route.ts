/**
 * GET /api/reconciliation/upload — List reconciliation exceptions (open/under_review)
 *
 * Upload endpoint reserved for future bank-statement file intake.
 * Currently serves as the exception list for the reconciliation dashboard.
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { listExceptions } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'commercial_reporting',
    openapi: {
      tags: ['Reconciliation'],
      summary: 'List reconciliation exceptions for the organization',
    },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view', requiresLedger: true }),
    );
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const statusFilter = status
      ? (status.split(',') as ('open' | 'under_review' | 'resolved' | 'written_off')[])
      : undefined;
    const exceptions = await listExceptions(organizationId, statusFilter);
    return { exceptions };
  },
);
