/**
 * Strike Fund Dashboard
 *
 * GET /api/strike-fund/dashboard
 *
 * Returns summary statistics for the strike fund dashboard.
 * CONTAINMENT (PR #752 round 30): strike_fund_disbursements has no
 * organization_id column, so the balance/payment query below cannot be
 * scoped to the caller's organization — it would otherwise sum every
 * organization's strike-fund activity into one number. Until an
 * organization-bound schema/backfill lands (see
 * db/rls-storage-authority/finance.ts's strike_fund_disbursements entry),
 * this route returns the same safe zeroed state used for metrics without a
 * backing table, rather than leaking a cross-organization aggregate.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['StrikeFund'], summary: 'Strike fund dashboard stats' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    // strike_fund_disbursements has no organization_id — see containment note above.
    return {
      totalBalance: 0,
      weeklyDisbursements: 0,
      activeRecipients: 0,
      // No applications table exists yet — return zero
      pendingApplications: 0,
    };
  },
);

