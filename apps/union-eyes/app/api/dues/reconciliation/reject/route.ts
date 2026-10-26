/**
 * Reject Reconciliation Line Item
 *
 * POST /api/dues/reconciliation/reject — Mark a line item as an exception with a reason
 *
 * Body: { remittanceId: string; reason: string }
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { remittanceLineItems } from '@/db/schema/dues-finance-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const schema = z.object({
  remittanceId: z.guid(),
  reason: z.string().min(1).max(500),
});

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Reject a remittance line item' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('Invalid request body');

    const { remittanceId, reason } = parsed.data;

    await withRLSContext(async (tx) => {
      const rows = await tx
        .update(remittanceLineItems)
        .set({
          lineStatus: 'exception',
          exceptionReason: reason,
          resolvedAt: new Date(),
          resolvedBy: userId ?? undefined,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(remittanceLineItems.remittanceId, remittanceId),
            eq(remittanceLineItems.organizationId, organizationId),
          ),
        )
        .returning();
      if (rows.length === 0) throw ApiError.notFound('Line item not found');
      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId!,
        action: 'dues.reconciliation.reject',
        resourceType: 'remittance_line_items',
        resourceId: remittanceId,
        details: { reason, lineItems: rows.length },
      });
    });

    return { success: true };
  },
);
