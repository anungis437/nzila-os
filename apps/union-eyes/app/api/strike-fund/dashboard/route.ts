/**
 * Strike Fund Dashboard
 *
 * GET /api/strike-fund/dashboard
 *
 * Returns summary statistics for the strike fund dashboard.
 *
 * NOT IMPLEMENTED. This route previously returned a constant zeroed payload
 * (totalBalance: 0, ...), which asserted a $0 balance that no source supports.
 * strike_fund_disbursements is organization-scoped (migration
 * 20260909_strike_fund_disbursements_organization_id.sql) but records
 * disbursements only: there is no fund-balance source and no applications
 * table, so the figures this route advertised cannot be computed. It answers
 * 501 until those sources exist, and is limited to Secretary-Treasurer and above.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    // Fund-specific financial data: matches the /dashboard/strike-fund layout guard.
    auth: { minRole: 'secretary_treasurer' },
    openapi: { tags: ['StrikeFund'], summary: 'Strike fund dashboard stats (not implemented)' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    // Unknown is not zero (UE-OFFICER-EXECUTIVE-CANONICAL-2.1 §VII).
    throw ApiError.notImplemented(
      'Strike fund balances are not available: no fund-balance source or applications table exists.',
    );
  },
);

