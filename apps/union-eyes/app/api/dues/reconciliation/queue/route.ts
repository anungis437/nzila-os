/**
 * Reconciliation Queue
 *
 * GET /api/dues/reconciliation/queue — List remittance line items needing review
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db';
import { remittanceLineItems, employerRemittances } from '@/db/schema/dues-finance-schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'List remittance line items pending reconciliation' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    await withRLSContext({ organizationId, userId }, (tx) =>
      requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view', requiresLedger: true }),
    );

    const rows = await db
      .select({
        id: remittanceLineItems.id,
        remittanceId: remittanceLineItems.remittanceId,
        employeeNumber: remittanceLineItems.employeeNumber,
        employeeName: remittanceLineItems.employeeName,
        amount: remittanceLineItems.amount,
        lineStatus: remittanceLineItems.lineStatus,
        exceptionReason: remittanceLineItems.exceptionReason,
        matchConfidence: remittanceLineItems.matchConfidence,
        userId: remittanceLineItems.userId,
        createdAt: remittanceLineItems.createdAt,
        // Remittance context
        employerId: employerRemittances.employerId,
        periodStart: employerRemittances.periodStart,
        periodEnd: employerRemittances.periodEnd,
      })
      .from(remittanceLineItems)
      .leftJoin(
        employerRemittances,
        eq(remittanceLineItems.remittanceId, employerRemittances.id),
      )
      .where(
        and(
          eq(remittanceLineItems.organizationId, organizationId),
          sql`${remittanceLineItems.lineStatus} in ('pending', 'exception', 'manual_review')`,
        ),
      );

    return { data: rows, total: rows.length };
  },
);
