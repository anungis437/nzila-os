/**
 * GET /api/dues/balance — Get the authenticated member's dues balance
 *
 * Backed exclusively by the native member_dues_ledger table. Never
 * fabricates a balance, membership status, or payment date — if no
 * organization/user context is available, returns an explicit
 * `source: 'unavailable'` state instead.
 */

import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { toCents } from '@/lib/decimal-safe';

export const dynamic = 'force-dynamic';

const UNAVAILABLE_BALANCE = {
  source: 'unavailable' as const,
  currentBalance: 0,
  balanceStatus: 'paid_up' as const,
  isInArrears: false,
  arrearsAmount: 0,
  lastPayment: null,
};

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Dues'],
      summary: "Get the authenticated member's native dues balance",
    },
  },
  async ({ userId, organizationId }) => {
    if (!userId || !organizationId) {
      return UNAVAILABLE_BALANCE;
    }

    const [row] = await db
      .select({
        totalCharges: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'charge' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
        totalPayments: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'payment' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
        totalCredits: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'credit' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
        totalAdjustments: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'adjustment' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
        totalWriteOffs: sql<string>`COALESCE(SUM(CASE WHEN ${memberDuesLedger.transactionType} = 'write_off' THEN ${memberDuesLedger.amount} ELSE 0 END), 0)`,
      })
      .from(memberDuesLedger)
      .where(
        and(
          eq(memberDuesLedger.userId, userId),
          eq(memberDuesLedger.organizationId, organizationId),
          eq(memberDuesLedger.status, 'posted'),
        ),
      );

    const chargesCents = toCents(row?.totalCharges ?? '0');
    const paymentsCents = toCents(row?.totalPayments ?? '0');
    const creditsCents = toCents(row?.totalCredits ?? '0');
    const adjustmentsCents = toCents(row?.totalAdjustments ?? '0');
    const writeOffsCents = toCents(row?.totalWriteOffs ?? '0');
    const balanceCents = chargesCents - paymentsCents - creditsCents - adjustmentsCents - writeOffsCents;
    const currentBalance = balanceCents / 100;
    const balanceStatus = balanceCents > 0 ? 'owing' : balanceCents < 0 ? 'credit' : 'paid_up';

    const [lastPaymentRow] = await db
      .select({ amount: memberDuesLedger.amount, date: memberDuesLedger.transactionDate })
      .from(memberDuesLedger)
      .where(
        and(
          eq(memberDuesLedger.userId, userId),
          eq(memberDuesLedger.organizationId, organizationId),
          eq(memberDuesLedger.transactionType, 'payment'),
          eq(memberDuesLedger.status, 'posted'),
        ),
      )
      .orderBy(desc(memberDuesLedger.transactionDate))
      .limit(1);

    return {
      source: 'native' as const,
      currentBalance,
      balanceStatus,
      isInArrears: balanceStatus === 'owing',
      arrearsAmount: balanceStatus === 'owing' ? currentBalance : 0,
      lastPayment: lastPaymentRow
        ? { amount: Number(lastPaymentRow.amount), date: new Date(lastPaymentRow.date).toISOString() }
        : null,
    };
  },
);
