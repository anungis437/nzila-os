/**
 * Strike Fund Dashboard
 *
 * GET /api/strike-fund/dashboard
 *
 * Returns summary statistics for the strike fund dashboard.
 * Uses the `strikeFundDisbursements` table for actual balance/payment data.
 * Returns zeros for metrics without a backing table (applications, recipients)
 * to avoid runtime crashes — the UI shows a ready-but-empty state.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { strikeFundDisbursements } from '@/db/schema/strike-fund-tax-schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: { tags: ['StrikeFund'], summary: 'Strike fund dashboard stats' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentYear = String(now.getFullYear());

    // Total disbursed this year
    const [totals] = await db
      .select({
        totalBalance: sql<number>`COALESCE(SUM(payment_amount::numeric), 0)::float`,
        weeklyDisbursements: sql<number>`COALESCE(SUM(CASE WHEN payment_date >= ${weekAgo.toISOString()}::timestamptz THEN payment_amount::numeric ELSE 0 END), 0)::float`,
        activeRecipients: sql<number>`COUNT(DISTINCT user_id)::int`,
      })
      .from(strikeFundDisbursements)
      .where(eq(strikeFundDisbursements.taxYear, currentYear));

    return {
      totalBalance: totals?.totalBalance ?? 0,
      weeklyDisbursements: totals?.weeklyDisbursements ?? 0,
      activeRecipients: totals?.activeRecipients ?? 0,
      // No applications table exists yet — return zero
      pendingApplications: 0,
    };
  },
);
