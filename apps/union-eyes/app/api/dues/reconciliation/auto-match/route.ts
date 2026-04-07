/**
 * Auto-Match Reconciliation
 *
 * POST /api/dues/reconciliation/auto-match — Run automatic member matching
 * for pending remittance line items using employee number and name heuristics.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { remittanceLineItems } from '@/db/schema/dues-finance-schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Run automatic remittance line-item matching' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    // Fetch pending unmatched line items for this org
    const pending = await db
      .select()
      .from(remittanceLineItems)
      .where(
        and(
          eq(remittanceLineItems.organizationId, organizationId),
          eq(remittanceLineItems.lineStatus, 'pending'),
          isNull(remittanceLineItems.userId),
        ),
      );

    if (pending.length === 0) {
      return { matched: 0, unmatched: 0, message: 'No pending items to match' };
    }

    let matched = 0;

    // Attempt exact employee-number match against organization_members
    for (const item of pending) {
      if (!item.employeeNumber) continue;

      try {
        const memberRows = await withRLSContext(() =>
          db.execute(
            sql`SELECT user_id FROM organization_members
                WHERE organization_id = ${organizationId}::uuid
                  AND membership_number = ${item.employeeNumber}
                LIMIT 1`,
          ),
        );

        const memberId = (memberRows[0] as { user_id?: string } | undefined)?.user_id;

        if (memberId) {
          await db
            .update(remittanceLineItems)
            .set({
              userId: memberId,
              matchConfidence: 100,
              matchMethod: 'auto',
              lineStatus: 'matched',
              updatedAt: new Date(),
            })
            .where(eq(remittanceLineItems.id, item.id));
          matched++;
        }
      } catch (err) {
        logger.warn('Auto-match failed for line item', { id: item.id, err });
      }
    }

    const unmatched = pending.length - matched;

    // Mark remaining unmatched items as manual_review
    if (unmatched > 0) {
      await db
        .update(remittanceLineItems)
        .set({ lineStatus: 'manual_review', updatedAt: new Date() })
        .where(
          and(
            eq(remittanceLineItems.organizationId, organizationId),
            eq(remittanceLineItems.lineStatus, 'pending'),
            isNull(remittanceLineItems.userId),
          ),
        );
    }

    return { matched, unmatched };
  },
);
