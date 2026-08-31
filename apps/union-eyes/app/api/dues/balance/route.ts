/**
 * GET /api/dues/balance — Get the authenticated member's dues balance
 *
 * Backed exclusively by the native member_dues_ledger table. Never
 * fabricates a balance, membership status, or payment date.
 *
 * NO DATA != ZERO BALANCE: a member with zero member_dues_ledger rows has
 * not necessarily paid nothing — Union Eyes may simply never have received
 * dues data for them (a specialist external dues/membership system may be
 * authoritative). That case returns `available: false`, the same as a
 * missing auth context, and is distinguishable from a genuine posted $0
 * balance (which requires at least one real, posted ledger transaction).
 *
 * Balance sign convention (charges add, everything else subtracts as a
 * positive magnitude) is not invented here — it is the same convention
 * used by both production writers of member_dues_ledger:
 *   - app/api/portal/dues/pay/route.ts (balance = SUM(charge) −
 *     SUM(payment, credit, adjustment, write_off), status='posted' only)
 *   - app/api/dues/arrears/[id]/payment/route.ts (payment amount is a
 *     positive z.number().positive() that reduces balanceAfter)
 * Filtering by status='posted' (as both writers do) already excludes
 * pending, reversed, and voided rows from the balance — no separate
 * reversal handling is required here because reversed/voided rows never
 * carry status='posted'.
 */

import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { memberDuesLedger } from '@/db/schema/dues-finance-schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { toCents } from '@/lib/decimal-safe';

export const dynamic = 'force-dynamic';

interface LastPayment {
  amount: number;
  date: string;
}

type DuesBalanceContext =
  | {
      source: 'native' | 'integration';
      available: true;
      currentBalance: number;
      balanceStatus: 'paid_up' | 'owing' | 'credit';
      isInArrears: boolean;
      arrearsAmount: number;
      lastPayment: LastPayment | null;
      asOf: string;
    }
  | {
      source: 'unavailable';
      available: false;
      currentBalance: null;
      balanceStatus: null;
      isInArrears: null;
      arrearsAmount: null;
      lastPayment: null;
    };

const UNAVAILABLE: DuesBalanceContext = {
  source: 'unavailable',
  available: false,
  currentBalance: null,
  balanceStatus: null,
  isInArrears: null,
  arrearsAmount: null,
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
  async ({ userId, organizationId }): Promise<DuesBalanceContext> => {
    if (!userId || !organizationId) {
      return UNAVAILABLE;
    }

    // Existence check FIRST, independent of status: if Union Eyes has never
    // received any ledger activity for this member (any status), there is
    // no financial conclusion to report — not even "zero".
    const [existsRow] = await db
      .select({ id: memberDuesLedger.id })
      .from(memberDuesLedger)
      .where(and(eq(memberDuesLedger.userId, userId), eq(memberDuesLedger.organizationId, organizationId)))
      .limit(1);

    if (!existsRow) {
      return UNAVAILABLE;
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
      source: 'native',
      available: true,
      currentBalance,
      balanceStatus,
      isInArrears: balanceStatus === 'owing',
      arrearsAmount: balanceStatus === 'owing' ? currentBalance : 0,
      lastPayment: lastPaymentRow
        ? { amount: Number(lastPaymentRow.amount), date: new Date(lastPaymentRow.date).toISOString() }
        : null,
      asOf: new Date().toISOString(),
    };
  },
);
