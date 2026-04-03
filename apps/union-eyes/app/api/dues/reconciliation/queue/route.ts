/**
 * Reconciliation Queue
 *
 * GET /api/dues/reconciliation/queue — List remittance line items needing review
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { remittanceLineItems, employerRemittances } from '@/db/schema/dues-finance-schema';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'List remittance line items pending reconciliation' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

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
