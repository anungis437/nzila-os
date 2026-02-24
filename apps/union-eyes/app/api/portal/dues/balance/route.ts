/**
 * GET /api/portal/dues/balance
 *
 * Returns the authenticated member's current dues balance and summary.
 * Queries the member_dues_ledger via Drizzle (replaces Django CMS proxy).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { createLogger } from '@nzila/os-core'

const logger = createLogger('portal:dues:balance')

export const dynamic = 'force-dynamic';

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

    // Current balance: sum of all posted ledger entries for this member
    const [balanceRow] = await db
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

    const charges = parseFloat(balanceRow?.totalCharges ?? '0');
    const payments = parseFloat(balanceRow?.totalPayments ?? '0');
    const credits = parseFloat(balanceRow?.totalCredits ?? '0');
    const adjustments = parseFloat(balanceRow?.totalAdjustments ?? '0');
    const writeOffs = parseFloat(balanceRow?.totalWriteOffs ?? '0');

    // Balance = charges - (payments + credits + adjustments + write-offs)
    const currentBalance = charges - payments - credits - adjustments - writeOffs;

    // Last 5 transactions for recent-activity summary
    const recentTransactions = await db
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

    return NextResponse.json({
      success: true,
      data: {
        currentBalance: currentBalance.toFixed(2),
        balanceStatus: currentBalance <= 0 ? 'paid_up' : currentBalance > 0 ? 'owing' : 'credit',
        breakdown: {
          totalCharges: charges.toFixed(2),
          totalPayments: payments.toFixed(2),
          totalCredits: credits.toFixed(2),
          totalAdjustments: adjustments.toFixed(2),
          totalWriteOffs: writeOffs.toFixed(2),
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

