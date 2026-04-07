/**
 * Admin Dues Overview API
 *
 * Returns financial KPIs, payment stats, recent payments, and period
 * comparisons from the member_dues_ledger, member_arrears, and
 * employer_remittances tables.
 */
import { NextResponse } from 'next/server';
import { withMinRole } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { memberDuesLedger, memberArrears } from '@/db/schema';
import { eq, and, gte, lt, sql, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withMinRole('steward', async (_request, context) => {
  const organizationId = (context as { organizationId?: string }).organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = thisMonthStart;

  // ── Financial KPIs from member_dues_ledger ──────────────────────────
  const [kpiRow] = await db
    .select({
      totalCollected: sql<string>`COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)`,
      totalCharged: sql<string>`COALESCE(SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END), 0)`,
    })
    .from(memberDuesLedger)
    .where(eq(memberDuesLedger.organizationId, organizationId));

  const totalCollected = parseFloat(kpiRow?.totalCollected ?? '0');
  const totalCharged = parseFloat(kpiRow?.totalCharged ?? '0');

  // ── Arrears summary ─────────────────────────────────────────────────
  const [arrearsRow] = await db
    .select({
      totalOverdue: sql<string>`COALESCE(SUM(total_owed), 0)`,
      overdueCount: sql<string>`COUNT(CASE WHEN arrears_status != 'current' THEN 1 END)`,
    })
    .from(memberArrears)
    .where(eq(memberArrears.organizationId, organizationId));

  const totalOverdue = parseFloat(arrearsRow?.totalOverdue ?? '0');
  const totalOutstanding = Math.max(totalCharged - totalCollected, 0);

  // ── Payment stats ───────────────────────────────────────────────────
  const paymentStats = await db
    .select({
      status: memberDuesLedger.status,
      count: sql<string>`COUNT(*)`,
    })
    .from(memberDuesLedger)
    .where(eq(memberDuesLedger.organizationId, organizationId))
    .groupBy(memberDuesLedger.status);

  const statMap: Record<string, number> = {};
  for (const row of paymentStats) {
    statMap[row.status] = parseInt(row.count, 10);
  }

  // ── Recent payments ──────────────────────────────────────────────────
  const recentPayments = await db
    .select({
      id: memberDuesLedger.id,
      amount: memberDuesLedger.amount,
      status: memberDuesLedger.status,
      transactionDate: memberDuesLedger.transactionDate,
      periodStart: memberDuesLedger.periodStart,
      description: memberDuesLedger.description,
      userId: memberDuesLedger.userId,
    })
    .from(memberDuesLedger)
    .where(
      and(
        eq(memberDuesLedger.organizationId, organizationId),
        eq(memberDuesLedger.transactionType, 'payment'),
      ),
    )
    .orderBy(desc(memberDuesLedger.transactionDate))
    .limit(10);

  // ── Period comparison ────────────────────────────────────────────────
  const [thisMonthRow] = await db
    .select({
      collected: sql<string>`COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)`,
      outstanding: sql<string>`COALESCE(SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)`,
      txCount: sql<string>`COUNT(*)`,
    })
    .from(memberDuesLedger)
    .where(
      and(
        eq(memberDuesLedger.organizationId, organizationId),
        gte(memberDuesLedger.transactionDate, thisMonthStart),
      ),
    );

  const [lastMonthRow] = await db
    .select({
      collected: sql<string>`COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)`,
      outstanding: sql<string>`COALESCE(SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)`,
      txCount: sql<string>`COUNT(*)`,
    })
    .from(memberDuesLedger)
    .where(
      and(
        eq(memberDuesLedger.organizationId, organizationId),
        gte(memberDuesLedger.transactionDate, lastMonthStart),
        lt(memberDuesLedger.transactionDate, lastMonthEnd),
      ),
    );

  const overview = {
    financialKpis: {
      totalCollected,
      totalOutstanding,
      totalOverdue,
      currentBalance: totalCollected + totalOutstanding,
    },
    paymentStats: {
      pending: statMap['pending'] ?? 0,
      paid: statMap['posted'] ?? 0,
      overdue: parseInt(arrearsRow?.overdueCount ?? '0', 10),
      total: Object.values(statMap).reduce((a, b) => a + b, 0),
    },
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      memberName: p.userId ?? 'Unknown',
      amount: parseFloat(String(p.amount)),
      status: p.status,
      paidDate: p.transactionDate?.toISOString() ?? null,
      dueDate: p.periodStart?.toISOString() ?? '',
    })),
    periodStats: {
      thisMonth: {
        collected: parseFloat(thisMonthRow?.collected ?? '0'),
        outstanding: Math.max(parseFloat(thisMonthRow?.outstanding ?? '0'), 0),
        transactionCount: parseInt(thisMonthRow?.txCount ?? '0', 10),
      },
      lastMonth: {
        collected: parseFloat(lastMonthRow?.collected ?? '0'),
        outstanding: Math.max(parseFloat(lastMonthRow?.outstanding ?? '0'), 0),
        transactionCount: parseInt(lastMonthRow?.txCount ?? '0', 10),
      },
    },
  };

  return NextResponse.json(overview);
});
