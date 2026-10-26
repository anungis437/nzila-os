/**
 * Manual Reconciliation Match
 *
 * POST /api/dues/reconciliation/match — Manually match a remittance line item to a member
 *
 * Body: { remittanceId: string; memberId: string }
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
  memberId: z.guid(),
});

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Manually match a line item to a member' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('Invalid request body');

    const { remittanceId, memberId } = parsed.data;

    const updated = await withRLSContext(async (tx) => {
      const rows = await tx
        .update(remittanceLineItems)
        .set({
          userId: memberId,
          matchConfidence: 100,
          matchMethod: 'manual',
          lineStatus: 'matched',
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
        action: 'dues.reconciliation.manual_match',
        resourceType: 'remittance_line_items',
        resourceId: remittanceId,
        details: { memberId, lineItems: rows.length },
      });
      return rows;
    });

    return { success: true, updated: updated[0] };
  },
);
