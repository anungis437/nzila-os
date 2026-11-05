/**
 * GET /api/portal/dues/balance
 *
 * Returns the authenticated member's current dues balance and summary.
 * Queries the member_dues_ledger via Drizzle (replaces Django CMS proxy).
 *
 * The organization comes from the client, so only a live canonical member of it may read its ledger, and the read runs in that
 * organization's tenant transaction (the runtime role with the organization bound), as the member's own rows only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@nzila/platform-auth/entra/server';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { requireUserForOrganization } from '@/lib/api-auth-guard';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core'
import { toCents, fromCents } from '@/lib/decimal-safe'

const logger = createLogger('portal:dues:balance')

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the organizationId from query params or header
    const orgId = req.nextUrl.searchParams.get('organizationId')
      || req.headers.get('x-organization-id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Missing organizationId query parameter or x-organization-id header' },
        { status: 400 },
      );
    }
    if (!UUID.test(orgId)) {
      return NextResponse.json({ error: 'organizationId must be a UUID' }, { status: 400 });
    }

    // The organization comes from the client; only a live canonical member may read its ledger.
    try {
      await requireUserForOrganization(orgId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { balanceRow, recentTransactions } = await withRLSContext({ organizationId: orgId }, async (tx) => {
      // Current balance: sum of all posted ledger entries for this member
      const [balanceRow] = await tx
        .select({
          totalCharges: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'charge' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
          totalPayments: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'payment' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
          totalCredits: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'credit' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
          totalAdjustments: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'adjustment' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
          totalWriteOffs: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'write_off' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
          transactionCount: sql<string>`COUNT(*)`,
        })
        .from(memberDuesLedger)
        .where(
          and(
            eq(memberDuesLedger.userId, userId),
            eq(memberDuesLedger.organizationId, orgId),
            eq(memberDuesLedger.status, 'posted'),
          ),
        );

      // Last 5 transactions for recent-activity summary
      const recentTransactions = await tx
        .select({
          id: memberDuesLedger.id,
          type: memberDuesLedger.transactionType,
          amount: memberDuesLedger.amount,
          date: memberDuesLedger.transactionDate,
          description: memberDuesLedger.description,
          balanceAfter: memberDuesLedger.balanceAfter,
        })
        .from(memberDuesLedger)
        .where(
          and(
            eq(memberDuesLedger.userId, userId),
            eq(memberDuesLedger.organizationId, orgId),
            eq(memberDuesLedger.status, 'posted'),
          ),
        )
        .orderBy(desc(memberDuesLedger.transactionDate))
        .limit(5);

      return { balanceRow, recentTransactions };
    });

    const chargesCents = toCents(balanceRow?.totalCharges ?? '0');
    const paymentsCents = toCents(balanceRow?.totalPayments ?? '0');
    const creditsCents = toCents(balanceRow?.totalCredits ?? '0');
    const adjustmentsCents = toCents(balanceRow?.totalAdjustments ?? '0');
    const writeOffsCents = toCents(balanceRow?.totalWriteOffs ?? '0');

    // Balance = charges - (payments + credits + adjustments + write-offs)
    const balanceCents = chargesCents - paymentsCents - creditsCents - adjustmentsCents - writeOffsCents;
    const currentBalance = balanceCents / 100;

    return NextResponse.json({
      success: true,
      data: {
        currentBalance: currentBalance.toFixed(2),
        // Owing, settled to the cent, or ahead of what is charged: a negative balance is a credit, not "paid up".
        balanceStatus: balanceCents > 0 ? 'owing' : balanceCents < 0 ? 'credit' : 'paid_up',
        breakdown: {
          totalCharges: fromCents(chargesCents),
          totalPayments: fromCents(paymentsCents),
          totalCredits: fromCents(creditsCents),
          totalAdjustments: fromCents(adjustmentsCents),
          totalWriteOffs: fromCents(writeOffsCents),
        },
        transactionCount: parseInt(balanceRow?.transactionCount ?? '0', 10),
        recentTransactions,
      },
    });
  } catch (error) {
    logger.error('[portal/dues/balance] Error:', error instanceof Error ? error : { detail: error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dues balance' },
      { status: 500 },
    );
  }
}
