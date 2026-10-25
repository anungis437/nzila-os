/**
 * Auto-Match Reconciliation
 *
 * POST /api/dues/reconciliation/auto-match — Run automatic member matching
 * for pending remittance line items using employee number and name heuristics.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { db } from '@/db';
import { remittanceLineItems } from '@/db/schema/dues-finance-schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { roles: FINANCIAL_MEMBER_DATA_ROLES },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Dues'], summary: 'Run automatic remittance line-item matching' },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    // Matching, the hand-off of the rest to manual review, and the audit record commit together.
    return withRLSContext({ organizationId }, async (tx) => {
      const pending = await tx
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
      let ambiguous = 0;

      // Exact employee-number match against organization_members. A number that names more than one member is
      // ambiguous and goes to manual review: a payroll line is never attributed to a member on a guess.
      for (const item of pending) {
        if (!item.employeeNumber) continue;

        const memberRows = await tx.execute(
          sql`SELECT user_id FROM organization_members
              WHERE organization_id = ${organizationId}::uuid
                AND membership_number = ${item.employeeNumber}
              LIMIT 2`,
        );
        const candidates = Array.from(memberRows as unknown as Array<{ user_id?: string }>);
        if (candidates.length > 1) {
          ambiguous++;
          continue;
        }
        const memberId = candidates[0]?.user_id;

        if (memberId) {
          await tx
            .update(remittanceLineItems)
            .set({
              userId: memberId,
              matchConfidence: 100,
              matchMethod: 'auto',
              lineStatus: 'matched',
              updatedAt: new Date(),
            })
            .where(and(eq(remittanceLineItems.id, item.id), eq(remittanceLineItems.organizationId, organizationId)));
          matched++;
        }
      }

      const unmatched = pending.length - matched;

      if (unmatched > 0) {
        await tx
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

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'dues.reconciliation.auto_match',
        resourceType: 'remittance_line_items',
        resourceId: organizationId,
        details: { matched, unmatched, ambiguous },
      });
      logger.info('Auto-match completed', { organizationId, matched, unmatched, ambiguous });
      return { matched, unmatched };
    });
  },
);
