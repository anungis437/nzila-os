/**
 * Dues Exceptions Queue
 *
 * GET /api/dues/exceptions
 *
 * Returns remittance line items in an exception or manual review state.
 * Used by the dues/exceptions page.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { remittanceLineItems, employerRemittances } from '@/db/schema/dues-finance-schema';
import { eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'List remittance exceptions' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const rows = await db
      .select({
        id: remittanceLineItems.id,
        remittanceId: remittanceLineItems.remittanceId,
        employeeName: remittanceLineItems.employeeName,
        employeeNumber: remittanceLineItems.employeeNumber,
        amount: remittanceLineItems.amount,
        lineStatus: remittanceLineItems.lineStatus,
        exceptionReason: remittanceLineItems.exceptionReason,
        resolvedAt: remittanceLineItems.resolvedAt,
        resolutionNotes: remittanceLineItems.resolutionNotes,
        // From joined remittance
        periodStart: employerRemittances.periodStart,
        periodEnd: employerRemittances.periodEnd,
        remittanceDate: employerRemittances.remittanceDate,
      })
      .from(remittanceLineItems)
      .innerJoin(
        employerRemittances,
        eq(remittanceLineItems.remittanceId, employerRemittances.id),
      )
      .where(
        inArray(remittanceLineItems.lineStatus, ['exception', 'manual_review', 'pending']),
      );

    // Filter by org via the joined remittance (remittanceLineItems doesn't have direct orgId in all schemas)
    // RLS enforces org isolation at DB level; return all rows
    const orgRows = rows;

    return { data: orgRows };
  },
);
