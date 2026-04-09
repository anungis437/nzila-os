/**
 * Executive Financial Summary API
 *
 * GET /api/finance/summary — Consolidated financial intelligence for the
 * executive dashboard. Returns dues, remittances, collection rates,
 * member counts, payment plans, and period trends in a single call.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'financial_intelligence_suite',
    openapi: { tags: ['Finance'], summary: 'Executive financial summary' },
  },
  async ({ organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const orgIdCast = sql`${organizationId}::uuid`;

    // ── Remittance trend (monthly, last 12) ───────────────────────────
    const remittanceTrend = await db.execute(sql`
      SELECT
        fiscal_year                       AS "year",
        fiscal_month                      AS "month",
        total_amount::numeric             AS "amount",
        member_count                      AS "memberCount",
        expected_amount::numeric          AS "expected",
        variance::numeric                 AS "variance",
        is_reconciled                     AS "reconciled",
        processing_status                 AS "status"
      FROM employer_remittances
      WHERE organization_id = ${orgIdCast}
      ORDER BY fiscal_year DESC, fiscal_month DESC
      LIMIT 12
    `);

    // ── Collection rate (ratio of payments to charges) ────────────────
    const [collectionRow] = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'payment'
                          THEN ABS(amount) ELSE 0 END), 0)::numeric AS "totalPaid",
        COALESCE(SUM(CASE WHEN transaction_type = 'charge'
                          THEN amount ELSE 0 END), 0)::numeric      AS "totalCharged",
        COUNT(DISTINCT user_id)                                      AS "uniqueMembers"
      FROM member_dues_ledger
      WHERE organization_id = ${orgIdCast}
    `);

    const totalPaid = Number(collectionRow?.totalPaid ?? 0);
    const totalCharged = Number(collectionRow?.totalCharged ?? 0);
    const collectionRate = totalCharged > 0
      ? Math.round((totalPaid / totalCharged) * 1000) / 10
      : 100;

    // ── Member standing snapshot ──────────────────────────────────────
    const [standingRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                               AS "totalMembers",
        COUNT(*) FILTER (WHERE arrears_status = 'current')::int     AS "currentMembers",
        COUNT(*) FILTER (WHERE arrears_status = 'warning')::int     AS "warningMembers",
        COUNT(*) FILTER (WHERE arrears_status = 'suspended')::int   AS "suspendedMembers",
        COUNT(*) FILTER (WHERE has_payment_plan)::int               AS "onPaymentPlan"
      FROM member_arrears
      WHERE organization_id = ${orgIdCast}
    `);

    // ── Active payment plans ──────────────────────────────────────────
    const [planRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                 AS "activePlans",
        COALESCE(SUM(remaining_balance::numeric), 0)  AS "totalRemaining",
        COALESCE(SUM(total_paid::numeric), 0)         AS "totalRecovered"
      FROM payment_plans
      WHERE organization_id = ${orgIdCast}
        AND status = 'active'
    `);

    // ── Financial periods summary ─────────────────────────────────────
    const periods = await db.execute(sql`
      SELECT
        fiscal_year         AS "year",
        fiscal_month        AS "month",
        status,
        total_revenue::numeric  AS "revenue",
        total_arrears::numeric  AS "arrears",
        member_count            AS "memberCount"
      FROM financial_periods
      WHERE organization_id = ${orgIdCast}
      ORDER BY fiscal_year DESC, fiscal_month DESC
      LIMIT 6
    `);

    // ── Reconciliation health ─────────────────────────────────────────
    const [reconRow] = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE is_reconciled)::int      AS "reconciled",
        COUNT(*) FILTER (WHERE NOT is_reconciled)::int  AS "unreconciled",
        COALESCE(SUM(CASE WHEN NOT is_reconciled
          THEN total_amount::numeric ELSE 0 END), 0)    AS "unreconciledAmount"
      FROM employer_remittances
      WHERE organization_id = ${orgIdCast}
    `);

    // ── Org member count from org_members ─────────────────────────────
    const [orgRow] = await db.execute(sql`
      SELECT COUNT(*)::int AS "totalOrgMembers"
      FROM organization_members
      WHERE organization_id = ${organizationId}
    `);

    // ── Strike fund ──────────────────────────────────────────────────
    const [strikeRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                              AS "totalDisbursements",
        COALESCE(SUM(payment_amount), 0)                           AS "totalDisbursed",
        COUNT(*) FILTER (WHERE exceeds_threshold)::int             AS "craThresholdBreaches",
        COUNT(*) FILTER (WHERE requires_tax_slip)::int             AS "requiresT4a",
        COUNT(*) FILTER (WHERE t4a_generated)::int                 AS "t4aGenerated"
      FROM strike_fund_disbursements sfd
      JOIN organization_members om ON om.user_id = sfd.user_id
      WHERE om.organization_id = ${organizationId}
    `);

    // ── Per-capita tax obligations ───────────────────────────────────
    const perCapitaRows = await db.execute(sql`
      SELECT
        remittance_year                       AS "year",
        remittance_month                      AS "month",
        total_amount::numeric                 AS "amount",
        remittable_members::int               AS "members",
        per_capita_rate::numeric              AS "rate",
        status,
        due_date                              AS "dueDate"
      FROM per_capita_remittances
      WHERE organization_id = ${orgIdCast}
      ORDER BY remittance_year DESC, remittance_month DESC
      LIMIT 12
    `);

    const perCapitaArr = perCapitaRows as Record<string, unknown>[];
    const perCapitaTotalPaid = perCapitaArr
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + Number(r.amount), 0);
    const perCapitaTotalPending = perCapitaArr
      .filter((r) => r.status !== 'paid')
      .reduce((s, r) => s + Number(r.amount), 0);

    // ── Inbound per-capita (what child orgs owe THIS org) ────────────
    const inboundRows = await db.execute(sql`
      SELECT
        o.id                                          AS "orgId",
        o.name                                        AS "orgName",
        COALESCE(SUM(CASE WHEN r.status IN ('pending', 'submitted')
          THEN r.total_amount ELSE 0 END), 0)::numeric AS "totalDue",
        COALESCE(SUM(CASE WHEN r.status = 'paid'
          THEN r.total_amount ELSE 0 END), 0)::numeric AS "totalPaid",
        COALESCE(SUM(CASE WHEN r.status = 'overdue'
          THEN r.total_amount ELSE 0 END), 0)::numeric AS "totalOverdue",
        COUNT(CASE WHEN r.status = 'pending' THEN 1 END)::int  AS "pendingCount",
        COUNT(CASE WHEN r.status = 'overdue' THEN 1 END)::int  AS "overdueCount"
      FROM organizations o
      LEFT JOIN per_capita_remittances r
        ON r.from_organization_id = o.id
        AND r.remittance_year = EXTRACT(YEAR FROM CURRENT_DATE)::int
      WHERE o.parent_id = ${organizationId}
        AND o.status = 'active'
      GROUP BY o.id, o.name
      ORDER BY o.name
    `);

    const inboundArr = inboundRows as Record<string, unknown>[];
    const hasChildren = inboundArr.length > 0;
    const inboundTotalDue = inboundArr.reduce((s, r) => s + Number(r.totalDue), 0);
    const inboundTotalPaid = inboundArr.reduce((s, r) => s + Number(r.totalPaid), 0);
    const inboundTotalOverdue = inboundArr.reduce((s, r) => s + Number(r.totalOverdue), 0);

    // ── Grievance / arbitration costs ────────────────────────────────
    const [grievanceRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                           AS "totalClaims",
        COUNT(*) FILTER (WHERE status::text = 'open')::int      AS "openClaims",
        COALESCE(SUM(NULLIF(legal_costs, '')::numeric), 0)      AS "totalLegalCosts"
      FROM claims
      WHERE organization_id = ${orgIdCast}
    `);

    const [arbRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                            AS "totalArbitrations",
        COALESCE(SUM(a.estimated_cost), 0)::numeric              AS "estimatedCost",
        COALESCE(SUM(a.actual_cost), 0)::numeric                 AS "actualCost",
        COALESCE(SUM(a.union_cost_share), 0)::numeric            AS "unionShare"
      FROM arbitrations a
      JOIN claims c ON c.claim_id = a.grievance_id
      WHERE c.organization_id = ${orgIdCast}
    `);

    const [settlementRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                            AS "totalSettlements",
        COALESCE(SUM(monetary_amount), 0)                        AS "totalSettled",
        COUNT(*) FILTER (WHERE status = 'accepted')::int         AS "accepted"
      FROM grievance_settlements
      WHERE organization_id = ${orgIdCast}
    `);

    // ── Pension health ───────────────────────────────────────────────
    const [pensionRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                                AS "totalMembers",
        COUNT(*) FILTER (WHERE membership_status = 'active')::int    AS "activeMembers",
        COALESCE(SUM(years_of_service::numeric), 0)                  AS "totalYearsService"
      FROM pension_members
      WHERE organization_id = ${orgIdCast}
    `);

    const [contribRow] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                                        AS "totalContributions",
        COUNT(*) FILTER (WHERE payment_status = 'received')::int             AS "received",
        COUNT(*) FILTER (WHERE payment_status = 'pending')::int              AS "pending",
        COALESCE(SUM(CASE WHEN payment_status = 'received'
          THEN amount ELSE 0 END), 0)                                        AS "totalFunded",
        COALESCE(SUM(CASE WHEN payment_status = 'pending'
          THEN amount ELSE 0 END), 0)                                        AS "totalPending"
      FROM pension_contributions
      WHERE organization_id = ${orgIdCast}
    `);

    // ── GL / Budget snapshot ─────────────────────────────────────────
    const glSummary = await db.execute(sql`
      SELECT
        ca.type                                AS "accountType",
        SUM(tb.closing_balance::numeric)       AS "balance"
      FROM gl_trial_balance tb
      JOIN chart_of_accounts ca ON ca.id = tb.chart_of_accounts_id
      WHERE tb.organization_id = ${orgIdCast}
        AND tb.period_end_date = (
          SELECT MAX(period_end_date) FROM gl_trial_balance
          WHERE organization_id = ${orgIdCast}
        )
      GROUP BY ca.type
    `);

    const glMap: Record<string, number> = {};
    for (const row of glSummary as Record<string, unknown>[]) {
      glMap[String(row.accountType)] = Number(row.balance);
    }

    const budgetRows = await db.execute(sql`
      SELECT
        name,
        total_budget::numeric        AS "totalBudget",
        allocated_budget::numeric    AS "allocated",
        spent_budget::numeric        AS "spent",
        status
      FROM budget_pool
      WHERE organization_id = ${organizationId}
        AND status = 'active'
      ORDER BY total_budget DESC
    `);

    return {
      collectionRate,
      totalPaid,
      totalCharged,
      uniquePayingMembers: Number(collectionRow?.uniqueMembers ?? 0),
      totalOrgMembers: Number(orgRow?.totalOrgMembers ?? 0),

      memberStanding: {
        total: Number(standingRow?.totalMembers ?? 0),
        current: Number(standingRow?.currentMembers ?? 0),
        warning: Number(standingRow?.warningMembers ?? 0),
        suspended: Number(standingRow?.suspendedMembers ?? 0),
        onPaymentPlan: Number(standingRow?.onPaymentPlan ?? 0),
      },

      paymentPlans: {
        activePlans: Number(planRow?.activePlans ?? 0),
        totalRemaining: Number(planRow?.totalRemaining ?? 0),
        totalRecovered: Number(planRow?.totalRecovered ?? 0),
      },

      reconciliation: {
        reconciled: Number(reconRow?.reconciled ?? 0),
        unreconciled: Number(reconRow?.unreconciled ?? 0),
        unreconciledAmount: Number(reconRow?.unreconciledAmount ?? 0),
      },

      remittanceTrend: (remittanceTrend as Record<string, unknown>[]).map((r) => ({
        year: Number(r.year),
        month: Number(r.month),
        amount: Number(r.amount),
        memberCount: Number(r.memberCount),
        expected: Number(r.expected),
        variance: Number(r.variance),
        reconciled: Boolean(r.reconciled),
        status: String(r.status),
      })),

      financialPeriods: (periods as Record<string, unknown>[]).map((p) => ({
        year: Number(p.year),
        month: Number(p.month),
        status: String(p.status),
        revenue: Number(p.revenue),
        arrears: Number(p.arrears),
        memberCount: Number(p.memberCount),
      })),

      // ── New domains ──────────────────────────────────────────────────
      strikeFund: {
        totalDisbursements: Number(strikeRow?.totalDisbursements ?? 0),
        totalDisbursed: Number(strikeRow?.totalDisbursed ?? 0),
        craThresholdBreaches: Number(strikeRow?.craThresholdBreaches ?? 0),
        requiresT4a: Number(strikeRow?.requiresT4a ?? 0),
        t4aGenerated: Number(strikeRow?.t4aGenerated ?? 0),
      },

      perCapitaTax: {
        totalPaid: perCapitaTotalPaid,
        totalPending: perCapitaTotalPending,
        entries: perCapitaArr.map((r) => ({
          year: Number(r.year),
          month: Number(r.month),
          amount: Number(r.amount),
          members: Number(r.members),
          rate: Number(r.rate),
          status: String(r.status),
          dueDate: String(r.dueDate),
        })),
      },

      perCapitaInbound: {
        isParentOrg: hasChildren,
        childCount: inboundArr.length,
        totalDue: inboundTotalDue,
        totalPaid: inboundTotalPaid,
        totalOverdue: inboundTotalOverdue,
        children: inboundArr.map((r) => ({
          orgId: String(r.orgId),
          orgName: String(r.orgName),
          totalDue: Number(r.totalDue),
          totalPaid: Number(r.totalPaid),
          totalOverdue: Number(r.totalOverdue),
          pendingCount: Number(r.pendingCount),
          overdueCount: Number(r.overdueCount),
        })),
      },

      grievanceCosts: {
        totalClaims: Number(grievanceRow?.totalClaims ?? 0),
        openClaims: Number(grievanceRow?.openClaims ?? 0),
        totalLegalCosts: Number(grievanceRow?.totalLegalCosts ?? 0),
        arbitrations: {
          total: Number(arbRow?.totalArbitrations ?? 0),
          estimatedCost: Number(arbRow?.estimatedCost ?? 0),
          actualCost: Number(arbRow?.actualCost ?? 0),
          unionShare: Number(arbRow?.unionShare ?? 0),
        },
        settlements: {
          total: Number(settlementRow?.totalSettlements ?? 0),
          totalSettled: Number(settlementRow?.totalSettled ?? 0),
          accepted: Number(settlementRow?.accepted ?? 0),
        },
      },

      pensionHealth: {
        totalMembers: Number(pensionRow?.totalMembers ?? 0),
        activeMembers: Number(pensionRow?.activeMembers ?? 0),
        totalYearsService: Number(pensionRow?.totalYearsService ?? 0),
        contributions: {
          total: Number(contribRow?.totalContributions ?? 0),
          received: Number(contribRow?.received ?? 0),
          pending: Number(contribRow?.pending ?? 0),
          totalFunded: Number(contribRow?.totalFunded ?? 0),
          totalPending: Number(contribRow?.totalPending ?? 0),
        },
      },

      glSnapshot: {
        assets: glMap['asset'] ?? 0,
        liabilities: glMap['liability'] ?? 0,
        equity: glMap['equity'] ?? 0,
        revenue: glMap['revenue'] ?? 0,
        expenses: glMap['expense'] ?? 0,
        netPosition: (glMap['asset'] ?? 0) - (glMap['liability'] ?? 0),
      },

      budgets: (budgetRows as Record<string, unknown>[]).map((b) => ({
        name: String(b.name),
        totalBudget: Number(b.totalBudget),
        allocated: Number(b.allocated),
        spent: Number(b.spent),
        utilization: Number(b.totalBudget) > 0
          ? Math.round((Number(b.spent) / Number(b.totalBudget)) * 1000) / 10
          : 0,
      })),
    };
  },
);
