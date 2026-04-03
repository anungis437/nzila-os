/**
 * Manual Reconciliation Match
 *
 * POST /api/dues/reconciliation/match — Manually match a remittance line item to a member
 *
 * Body: { remittanceId: string; memberId: string }
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { db } from '@/db';
import { remittanceLineItems } from '@/db/schema/dues-finance-schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const schema = z.object({
  remittanceId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Manually match a line item to a member' },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw ApiError.badRequest('Invalid request body');

    const { remittanceId, memberId } = parsed.data;

    const updated = await db
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

    if (updated.length === 0) {
      throw ApiError.notFound('Line item not found');
    }

    return { success: true, updated: updated[0] };
  },
);
