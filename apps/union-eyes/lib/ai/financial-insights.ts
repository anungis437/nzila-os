/**
 * Governance-Safe Financial Cognition Service
 *
 * Produces bounded operational finance intelligence for the executive dashboard:
 * - Collection health contextualisation
 * - Arrears posture reading
 * - Budget variance interpretation
 * - Remittance cadence trend contextualisation
 * - Executive financial continuity narrative
 *
 * CONSTRAINTS:
 * - Every output: confidence + explanation
 * - All outputs are advisory — no automatic actions
 * - Org-scoped, audited
 * - Executives interpret financial posture; this system contextualises cadence signals.
 *
 * @module lib/ai/financial-insights
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { buildOrgAiTrace, getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type FinancialAnalysisType =
  | 'collection_health'
  | 'arrears_risk'
  | 'budget_variance'
  | 'remittance_trends'
  | 'comprehensive';

export type FinancialTimeframe = '30d' | '60d' | '90d' | '6m' | '12m';

export interface FinancialInsightEntry {
  label: string;
  value: number | string;
  trend: 'up' | 'down' | 'stable';
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface FinancialRiskEntry {
  area: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentMetric: number | string;
  threshold: number | string;
  description: string;
}

export interface FinancialRecommendation {
  action: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
  timeframe: string;
}

export interface FinancialInsightResult {
  analysisType: FinancialAnalysisType;
  timeframe: FinancialTimeframe;
  title: string;
  executiveSummary: string;
  insights: FinancialInsightEntry[];
  risks: FinancialRiskEntry[];
  recommendations: FinancialRecommendation[];
  dataSourcesUsed: string[];
}

const MODEL_VERSION = '1.0.0';

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Generate a financial insight report.
 */
export async function generateFinancialInsight(params: {
  analysisType: FinancialAnalysisType;
  timeframe: FinancialTimeframe;
  organizationId: string;
  userId: string;
}): Promise<AiResponseEnvelope<FinancialInsightResult>> {
  const { analysisType, timeframe, organizationId, userId } = params;

  // 1. Gather financial context
  const context = await gatherFinancialContext(organizationId);

  // 2. Call AI
  const ai = getAiClient();
  const prompt = buildFinancialPrompt(analysisType, timeframe, context);
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    trace: buildOrgAiTrace(organizationId),
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.FINANCIAL_ANALYSIS,
    input: prompt,
    dataClass: 'internal',
  });

  // 3. Parse
  const parsed = parseFinancialResponse(aiResult.content ?? '', analysisType, timeframe);

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'financial_analysis',
    userId,
    organizationId,
    resource: 'financial_insights',
    action: analysisType,
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  // 5. Return envelope (no DB persistence — aiInsightReports enum doesn't include financial types)
  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

// ============================================================================
// INTERNALS
// ============================================================================

interface FinancialContext {
  collectionRate: number;
  totalPaid: number;
  totalCharged: number;
  uniquePayingMembers: number;
  totalOrgMembers: number;
  memberStanding: {
    current: number;
    warning: number;
    suspended: number;
    onPaymentPlan: number;
    total: number;
  };
  paymentPlans: { activePlans: number; totalRemaining: number; totalRecovered: number };
  reconciliation: { reconciled: number; unreconciled: number; unreconciledAmount: number };
  remittanceTrend: { year: number; month: number; amount: number; expected: number; variance: number; reconciled: boolean }[];
  strikeFund: { totalDisbursed: number; totalDisbursements: number; craThresholdBreaches: number };
  pensionFunding: { totalFunded: number; totalPending: number; activeMembers: number };
  glSnapshot: { assets: number; liabilities: number; equity: number; revenue: number; expenses: number };
  budgets: { name: string; totalBudget: number; spent: number; utilization: number }[];
  legalCosts: { totalClaims: number; openClaims: number; totalLegalCosts: number };
}

async function gatherFinancialContext(organizationId: string): Promise<FinancialContext> {
  const orgIdCast = sql`${organizationId}::uuid`;

  // Run all queries in parallel
  const [
    collectionRows,
    standingRows,
    planRows,
    reconRows,
    remittanceRows,
    orgRows,
    strikeRows,
    contribRows,
    glRows,
    budgetRows,
    claimsRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN transaction_type = 'payment' THEN ABS(amount) ELSE 0 END), 0)::numeric AS "totalPaid",
        COALESCE(SUM(CASE WHEN transaction_type = 'charge' THEN amount ELSE 0 END), 0)::numeric AS "totalCharged",
        COUNT(DISTINCT user_id) AS "uniqueMembers"
      FROM member_dues_ledger WHERE organization_id = ${orgIdCast}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE arrears_status = 'current')::int AS "current",
        COUNT(*) FILTER (WHERE arrears_status = 'warning')::int AS "warning",
        COUNT(*) FILTER (WHERE arrears_status = 'suspended')::int AS "suspended",
        COUNT(*) FILTER (WHERE has_payment_plan)::int AS "onPaymentPlan"
      FROM member_arrears WHERE organization_id = ${orgIdCast}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS "activePlans",
        COALESCE(SUM(remaining_balance::numeric), 0) AS "totalRemaining",
        COALESCE(SUM(total_paid::numeric), 0) AS "totalRecovered"
      FROM payment_plans WHERE organization_id = ${orgIdCast} AND status = 'active'
    `),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE is_reconciled)::int AS "reconciled",
        COUNT(*) FILTER (WHERE NOT is_reconciled)::int AS "unreconciled",
        COALESCE(SUM(CASE WHEN NOT is_reconciled THEN total_amount::numeric ELSE 0 END), 0) AS "unreconciledAmount"
      FROM employer_remittances WHERE organization_id = ${orgIdCast}
    `),
    db.execute(sql`
      SELECT
        fiscal_year AS "year", fiscal_month AS "month",
        total_amount::numeric AS "amount", expected_amount::numeric AS "expected",
        variance::numeric AS "variance", is_reconciled AS "reconciled"
      FROM employer_remittances WHERE organization_id = ${orgIdCast}
      ORDER BY fiscal_year DESC, fiscal_month DESC LIMIT 12
    `),
    db.execute(sql`SELECT COUNT(*)::int AS "totalOrgMembers" FROM organization_members WHERE organization_id = ${organizationId}`),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalDisbursements",
        COALESCE(SUM(payment_amount), 0) AS "totalDisbursed",
        COUNT(*) FILTER (WHERE exceeds_threshold)::int AS "craThresholdBreaches"
      FROM strike_fund_disbursements sfd
      JOIN organization_members om ON om.user_id = sfd.user_id
      WHERE om.organization_id = ${organizationId}
    `),
    db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'received' THEN amount ELSE 0 END), 0) AS "totalFunded",
        COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END), 0) AS "totalPending",
        COUNT(*) FILTER (WHERE payment_status = 'received')::int AS "activeMembers"
      FROM pension_contributions WHERE organization_id = ${orgIdCast}
    `),
    db.execute(sql`
      SELECT ca.type AS "accountType", SUM(tb.closing_balance::numeric) AS "balance"
      FROM gl_trial_balance tb
      JOIN chart_of_accounts ca ON ca.id = tb.chart_of_accounts_id
      WHERE tb.organization_id = ${orgIdCast}
        AND tb.period_end_date = (SELECT MAX(period_end_date) FROM gl_trial_balance WHERE organization_id = ${orgIdCast})
      GROUP BY ca.type
    `),
    db.execute(sql`
      SELECT name, total_budget::numeric AS "totalBudget", spent_budget::numeric AS "spent", status
      FROM budget_pool WHERE organization_id = ${organizationId} AND status = 'active'
      ORDER BY total_budget DESC
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalClaims",
        COUNT(*) FILTER (WHERE status::text = 'open')::int AS "openClaims",
        COALESCE(SUM(NULLIF(legal_costs, '')::numeric), 0) AS "totalLegalCosts"
      FROM claims WHERE organization_id = ${orgIdCast}
    `),
  ]);

  const collection = collectionRows[0] as Record<string, unknown> | undefined;
  const standing = standingRows[0] as Record<string, unknown> | undefined;
  const plan = planRows[0] as Record<string, unknown> | undefined;
  const recon = reconRows[0] as Record<string, unknown> | undefined;
  const org = orgRows[0] as Record<string, unknown> | undefined;
  const strike = strikeRows[0] as Record<string, unknown> | undefined;
  const contrib = contribRows[0] as Record<string, unknown> | undefined;
  const claims = claimsRows[0] as Record<string, unknown> | undefined;

  const totalPaid = Number(collection?.totalPaid ?? 0);
  const totalCharged = Number(collection?.totalCharged ?? 0);
  const collectionRate = totalCharged > 0 ? Math.round((totalPaid / totalCharged) * 1000) / 10 : 100;

  const glMap: Record<string, number> = {};
  for (const row of glRows as Record<string, unknown>[]) {
    glMap[String(row.accountType)] = Number(row.balance);
  }

  const budgets = (budgetRows as Record<string, unknown>[]).map((b) => {
    const total = Number(b.totalBudget);
    const spent = Number(b.spent);
    return {
      name: String(b.name),
      totalBudget: total,
      spent,
      utilization: total > 0 ? Math.round((spent / total) * 100) : 0,
    };
  });

  return {
    collectionRate,
    totalPaid,
    totalCharged,
    uniquePayingMembers: Number(collection?.uniqueMembers ?? 0),
    totalOrgMembers: Number(org?.totalOrgMembers ?? 0),
    memberStanding: {
      total: Number(standing?.total ?? 0),
      current: Number(standing?.current ?? 0),
      warning: Number(standing?.warning ?? 0),
      suspended: Number(standing?.suspended ?? 0),
      onPaymentPlan: Number(standing?.onPaymentPlan ?? 0),
    },
    paymentPlans: {
      activePlans: Number(plan?.activePlans ?? 0),
      totalRemaining: Number(plan?.totalRemaining ?? 0),
      totalRecovered: Number(plan?.totalRecovered ?? 0),
    },
    reconciliation: {
      reconciled: Number(recon?.reconciled ?? 0),
      unreconciled: Number(recon?.unreconciled ?? 0),
      unreconciledAmount: Number(recon?.unreconciledAmount ?? 0),
    },
    remittanceTrend: (remittanceRows as Record<string, unknown>[]).map((r) => ({
      year: Number(r.year),
      month: Number(r.month),
      amount: Number(r.amount),
      expected: Number(r.expected),
      variance: Number(r.variance),
      reconciled: Boolean(r.reconciled),
    })),
    strikeFund: {
      totalDisbursed: Number(strike?.totalDisbursed ?? 0),
      totalDisbursements: Number(strike?.totalDisbursements ?? 0),
      craThresholdBreaches: Number(strike?.craThresholdBreaches ?? 0),
    },
    pensionFunding: {
      totalFunded: Number(contrib?.totalFunded ?? 0),
      totalPending: Number(contrib?.totalPending ?? 0),
      activeMembers: Number(contrib?.activeMembers ?? 0),
    },
    glSnapshot: {
      assets: glMap['asset'] ?? 0,
      liabilities: glMap['liability'] ?? 0,
      equity: glMap['equity'] ?? 0,
      revenue: glMap['revenue'] ?? 0,
      expenses: glMap['expense'] ?? 0,
    },
    budgets,
    legalCosts: {
      totalClaims: Number(claims?.totalClaims ?? 0),
      openClaims: Number(claims?.openClaims ?? 0),
      totalLegalCosts: Number(claims?.totalLegalCosts ?? 0),
    },
  };
}

function buildFinancialPrompt(
  analysisType: FinancialAnalysisType,
  timeframe: FinancialTimeframe,
  ctx: FinancialContext,
): string {
  const remittanceSummary = ctx.remittanceTrend
    .slice(0, 6)
    .map((r) => `  ${r.year}-${String(r.month).padStart(2, '0')}: collected $${r.amount}, expected $${r.expected}, variance $${r.variance}, reconciled=${r.reconciled}`)
    .join('\n');

  const budgetSummary = ctx.budgets
    .map((b) => `  ${b.name}: budget $${b.totalBudget}, spent $${b.spent} (${b.utilization}%)`)
    .join('\n');

  const netPosition = ctx.glSnapshot.assets - ctx.glSnapshot.liabilities;

  return [
    'You are a financial analyst for a union organization. Provide executive-level financial intelligence.',
    `Generate a "${analysisType}" analysis for the last ${timeframe}.`,
    '',
    'FINANCIAL CONTEXT:',
    `  Collection rate: ${ctx.collectionRate}%`,
    `  Total paid: $${ctx.totalPaid}`,
    `  Total charged: $${ctx.totalCharged}`,
    `  Paying members: ${ctx.uniquePayingMembers} of ${ctx.totalOrgMembers}`,
    '',
    'MEMBER STANDING:',
    `  Current: ${ctx.memberStanding.current}`,
    `  Warning: ${ctx.memberStanding.warning}`,
    `  Suspended: ${ctx.memberStanding.suspended}`,
    `  On payment plan: ${ctx.memberStanding.onPaymentPlan}`,
    `  Total tracked: ${ctx.memberStanding.total}`,
    '',
    'PAYMENT PLANS:',
    `  Active plans: ${ctx.paymentPlans.activePlans}`,
    `  Recovered: $${ctx.paymentPlans.totalRecovered}`,
    `  Remaining: $${ctx.paymentPlans.totalRemaining}`,
    '',
    'RECONCILIATION:',
    `  Reconciled: ${ctx.reconciliation.reconciled}`,
    `  Unreconciled: ${ctx.reconciliation.unreconciled} ($${ctx.reconciliation.unreconciledAmount})`,
    '',
    'REMITTANCE TREND (recent months):',
    remittanceSummary || '  No data',
    '',
    'BALANCE SHEET:',
    `  Assets: $${ctx.glSnapshot.assets}`,
    `  Liabilities: $${ctx.glSnapshot.liabilities}`,
    `  Net position: $${netPosition}`,
    `  Revenue YTD: $${ctx.glSnapshot.revenue}`,
    `  Expenses YTD: $${ctx.glSnapshot.expenses}`,
    '',
    'BUDGETS:',
    budgetSummary || '  No active budgets',
    '',
    'OTHER:',
    `  Strike fund disbursed: $${ctx.strikeFund.totalDisbursed} (${ctx.strikeFund.totalDisbursements} disbursements, ${ctx.strikeFund.craThresholdBreaches} CRA breaches)`,
    `  Pension funded: $${ctx.pensionFunding.totalFunded}, pending: $${ctx.pensionFunding.totalPending} (${ctx.pensionFunding.activeMembers} active)`,
    `  Legal costs: $${ctx.legalCosts.totalLegalCosts} (${ctx.legalCosts.openClaims} open of ${ctx.legalCosts.totalClaims} total)`,
    '',
    'Return JSON: {',
    '  "title": string,',
    '  "executiveSummary": string (2-3 sentence NL summary for leadership),',
    '  "insights": [{ "label": string, "value": number|string, "trend": "up"|"down"|"stable", "severity": "info"|"warning"|"critical", "description": string }],',
    '  "risks": [{ "area": string, "riskLevel": "low"|"medium"|"high"|"critical", "currentMetric": number|string, "threshold": number|string, "description": string }],',
    '  "recommendations": [{ "action": string, "priority": "low"|"medium"|"high", "impact": string, "timeframe": string }],',
    '  "dataSourcesUsed": string[],',
    '  "confidence": number (0-1),',
    '  "explanation": string',
    '}',
    '',
    'Respond ONLY with valid JSON.',
  ].join('\n');
}

function parseFinancialResponse(
  raw: string,
  analysisType: FinancialAnalysisType,
  timeframe: FinancialTimeframe,
): { result: FinancialInsightResult; confidence: number; explanation: string } {
  try {
    const json = JSON.parse(raw);
    return {
      result: {
        analysisType,
        timeframe,
        title: String(json.title ?? `Financial ${analysisType} report`),
        executiveSummary: String(json.executiveSummary ?? ''),
        insights: Array.isArray(json.insights) ? json.insights : [],
        risks: Array.isArray(json.risks) ? json.risks : [],
        recommendations: Array.isArray(json.recommendations) ? json.recommendations : [],
        dataSourcesUsed: Array.isArray(json.dataSourcesUsed) ? json.dataSourcesUsed : [],
      },
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      explanation: String(json.explanation ?? 'AI-generated financial insight report.'),
    };
  } catch {
    logger.warn('Failed to parse financial insights AI response');
    return {
      result: {
        analysisType,
        timeframe,
        title: `Financial ${analysisType} (parse error)`,
        executiveSummary: 'Unable to parse AI response. Manual financial analysis recommended.',
        insights: [],
        risks: [],
        recommendations: [],
        dataSourcesUsed: [],
      },
      confidence: 0.2,
      explanation: 'AI response could not be parsed.',
    };
  }
}
