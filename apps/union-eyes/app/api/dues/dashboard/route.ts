/**
 * Dues Dashboard
 *
 * GET /api/dues/dashboard — Aggregate stats for the dues overview page
 *
 * Returns:
 *   totalCollected  — total amount from reconciled remittances this fiscal year
 *   pendingRemittances — total amount in remittances still pending reconciliation
 *   inArrears       — total amount owed across all members in arrears
 *   reconciliationQueue — count of pending/exception line items needing review
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { memberArrears, employerRemittances, remittanceLineItems } from '@/db/schema/dues-finance-schema';
import { eq, and, sql, ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Dues dashboard aggregate stats' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const [arrearsRow] = await db
      .select({
        totalOwed: sql<string>`coalesce(sum(${memberArrears.totalOwed}), '0')`,
      })
      .from(memberArrears)
      .where(
        and(
          eq(memberArrears.organizationId, organizationId),
          ne(memberArrears.arrearsStatus, 'current'),
        ),
      );

    const [remittancesRow] = await db
      .select({
        totalCollected: sql<string>`coalesce(sum(case when ${employerRemittances.isReconciled} then ${employerRemittances.totalAmount} else 0 end), '0')`,
        pendingAmount: sql<string>`coalesce(sum(case when not ${employerRemittances.isReconciled} then ${employerRemittances.totalAmount} else 0 end), '0')`,
      })
      .from(employerRemittances)
      .where(eq(employerRemittances.organizationId, organizationId));

    const [queueRow] = await db
      .select({
        queueCount: sql<number>`count(*)::int`,
      })
      .from(remittanceLineItems)
      .where(
        and(
          eq(remittanceLineItems.organizationId, organizationId),
          sql`${remittanceLineItems.lineStatus} in ('pending', 'exception', 'manual_review')`,
        ),
      );

    return {
      totalCollected: parseFloat(remittancesRow?.totalCollected ?? '0'),
      pendingRemittances: parseFloat(remittancesRow?.pendingAmount ?? '0'),
      inArrears: parseFloat(arrearsRow?.totalOwed ?? '0'),
      reconciliationQueue: queueRow?.queueCount ?? 0,
    };
  },
);
