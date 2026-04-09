/**
 * Admin Dues Overview API
 *
 * Returns financial KPIs, payment stats, recent payments, and period
 * comparisons from the member_dues_ledger, member_arrears, and
 * employer_remittances tables.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { memberDuesLedger, memberArrears } from '@/db/schema';
import { eq, and, gte, lt, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Admin', 'Dues'], summary: 'Admin dues overview' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

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
  const recentPayments = await db.execute(sql`
    SELECT
      mdl.id,
      mdl.amount,
      mdl.status,
      mdl.transaction_date AS "transactionDate",
      mdl.period_start     AS "periodStart",
      mdl.description,
      mdl.user_id          AS "userId",
      om.name              AS "memberName"
    FROM member_dues_ledger mdl
    LEFT JOIN organization_members om
      ON om.user_id = mdl.user_id
     AND om.organization_id = mdl.organization_id::text
    WHERE mdl.organization_id = ${organizationId}::uuid
      AND mdl.transaction_type = 'payment'
    ORDER BY mdl.transaction_date DESC
    LIMIT 10
  `);

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
    recentPayments: recentPayments.map((p: Record<string, unknown>) => ({
      id: p.id,
      memberName: (p.memberName as string) ?? (p.userId as string) ?? 'Unknown',
      amount: parseFloat(String(p.amount)),
      status: p.status,
      paidDate: p.transactionDate ? String(p.transactionDate) : null,
      dueDate: p.periodStart ? String(p.periodStart) : '',
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

    return overview;
  },
);
