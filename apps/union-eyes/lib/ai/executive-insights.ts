/**
 * Executive Insights AI Service
 *
 * Generates forward-looking intelligence for union leadership:
 * - Trend forecasts (grievance volume, compliance, financials)
 * - Employer hotspot detection
 * - Steward capacity projections
 * - Arbitration escalation predictions
 * - Executive summaries
 *
 * CONSTRAINTS:
 * - Every output: confidence + explanation
 * - All insights are advisory — no automatic actions
 * - Org-scoped, audited
 *
 * @module lib/ai/executive-insights
 */

import { db } from '@/db/db';
import { eq, and, desc, gte, count, sql } from 'drizzle-orm';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { aiInsightReports, type AiInsightReportInsert } from '@/db/schema/domains/ml/ai-insight-reports';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { employers } from '@/db/schema/domains/compliance/employer-compliance';
import { complianceAlerts } from '@/db/schema/domains/compliance/employer-compliance';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export type InsightReportType =
  | 'trend_forecast'
  | 'employer_hotspots'
  | 'steward_capacity'
  | 'arbitration_escalation'
  | 'executive_summary';

export type InsightTimeframe = '30d' | '60d' | '90d' | '6m' | '12m';

export interface InsightEntry {
  label: string;
  value: number | string;
  trend: 'up' | 'down' | 'stable';
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface PredictionEntry {
  metric: string;
  currentValue: number;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  horizon: string;
}

export interface RecommendationEntry {
  action: string;
  priority: 'low' | 'medium' | 'high';
  impact: string;
  effort: string;
}

export interface InsightResult {
  reportType: InsightReportType;
  timeframe: InsightTimeframe;
  title: string;
  summary: string;
  insights: InsightEntry[];
  predictions: PredictionEntry[];
  recommendations: RecommendationEntry[];
  dataSourcesUsed: string[];
}

const MODEL_VERSION = '1.0.0';

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Generate an executive insight report.
 */
export async function generateInsightReport(params: {
  reportType: InsightReportType;
  timeframe: InsightTimeframe;
  organizationId: string;
  userId: string;
}): Promise<AiResponseEnvelope<InsightResult>> {
  const { reportType, timeframe, organizationId, userId } = params;

  // 1. Gather data context
  const context = await gatherOrgContext(organizationId, timeframe);

  // 2. Call AI
  const ai = getAiClient();
  const prompt = buildInsightPrompt(reportType, timeframe, context);
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EXECUTIVE_INSIGHTS,
    input: prompt,
    dataClass: 'internal',
  });

  // 3. Parse
  const parsed = parseInsightResponse(aiResult.content ?? '', reportType, timeframe);

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'executive_insights',
    userId,
    organizationId,
    resource: 'insight_reports',
    action: reportType,
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  // 5. Persist
  const insert: AiInsightReportInsert = {
    organizationId,
    reportType,
    timeframe,
    title: parsed.result.title,
    summary: parsed.result.summary,
    insightsJson: parsed.result.insights,
    predictionsJson: parsed.result.predictions.length > 0 ? parsed.result.predictions : null,
    recommendationsJson: parsed.result.recommendations.length > 0 ? parsed.result.recommendations : null,
    confidence: parsed.confidence.toFixed(4),
    explanation: parsed.explanation,
    dataSourcesUsed: parsed.result.dataSourcesUsed,
    modelVersion: MODEL_VERSION,
    profileKey: UE_PROFILES.EXECUTIVE_INSIGHTS,
    auditRef,
  };

  await db.insert(aiInsightReports).values(insert);

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

/**
 * Convenience: Generate trend forecast.
 */
export async function generateTrendForecast(
  organizationId: string,
  timeframe: InsightTimeframe,
  userId: string,
) {
  return generateInsightReport({ reportType: 'trend_forecast', timeframe, organizationId, userId });
}

/**
 * Convenience: Predict employer hotspots.
 */
export async function forecastEmployerHotspots(
  organizationId: string,
  timeframe: InsightTimeframe,
  userId: string,
) {
  return generateInsightReport({ reportType: 'employer_hotspots', timeframe, organizationId, userId });
}

/**
 * Convenience: Predict steward capacity.
 */
export async function predictStewardCapacity(
  organizationId: string,
  timeframe: InsightTimeframe,
  userId: string,
) {
  return generateInsightReport({ reportType: 'steward_capacity', timeframe, organizationId, userId });
}

/**
 * Convenience: Predict arbitration escalation.
 */
export async function predictArbitrationEscalation(
  organizationId: string,
  timeframe: InsightTimeframe,
  userId: string,
) {
  return generateInsightReport({ reportType: 'arbitration_escalation', timeframe, organizationId, userId });
}

/**
 * Get previously generated reports.
 */
export async function getInsightReports(
  organizationId: string,
  reportType?: InsightReportType,
  limit = 10,
) {
  const conditions = [eq(aiInsightReports.organizationId, organizationId)];
  if (reportType) conditions.push(eq(aiInsightReports.reportType, reportType));

  return db.query.aiInsightReports.findMany({
    where: and(...conditions),
    orderBy: [desc(aiInsightReports.createdAt)],
    limit,
  });
}

// ============================================================================
// INTERNALS
// ============================================================================

interface OrgContext {
  grievanceCounts: { total: number; open: number; arbitration: number };
  employerCount: number;
  alertCount: number;
  recentGrievanceTypes: string[];
}

async function gatherOrgContext(
  organizationId: string,
  timeframe: InsightTimeframe,
): Promise<OrgContext> {
  const now = new Date();
  const daysMap: Record<InsightTimeframe, number> = {
    '30d': 30,
    '60d': 60,
    '90d': 90,
    '6m': 180,
    '12m': 365,
  };
  const sinceDate = new Date(now.getTime() - daysMap[timeframe] * 24 * 60 * 60 * 1000);

  const [totalG] = await db
    .select({ value: count() })
    .from(grievances)
    .where(and(eq(grievances.organizationId, organizationId), gte(grievances.createdAt, sinceDate)));

  const [openG] = await db
    .select({ value: count() })
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, organizationId),
        sql`${grievances.status} NOT IN ('closed', 'withdrawn', 'settled')`,
      ),
    );

  const [arbG] = await db
    .select({ value: count() })
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, organizationId),
        eq(grievances.status, 'arbitration'),
        gte(grievances.createdAt, sinceDate),
      ),
    );

  const [empCount] = await db
    .select({ value: count() })
    .from(employers)
    .where(eq(employers.orgId, organizationId));

  const [alertC] = await db
    .select({ value: count() })
    .from(complianceAlerts)
    .where(and(eq(complianceAlerts.orgId, organizationId), gte(complianceAlerts.createdAt, sinceDate)));

  return {
    grievanceCounts: {
      total: totalG?.value ?? 0,
      open: openG?.value ?? 0,
      arbitration: arbG?.value ?? 0,
    },
    employerCount: empCount?.value ?? 0,
    alertCount: alertC?.value ?? 0,
    recentGrievanceTypes: [], // simplified — could be enriched
  };
}

function buildInsightPrompt(
  reportType: InsightReportType,
  timeframe: InsightTimeframe,
  ctx: OrgContext,
): string {
  return [
    'You are an executive analytics assistant for a union organization.',
    `Generate a "${reportType}" report for the last ${timeframe}.`,
    '',
    'Organization context:',
    `  Total grievances (period): ${ctx.grievanceCounts.total}`,
    `  Open grievances: ${ctx.grievanceCounts.open}`,
    `  In arbitration: ${ctx.grievanceCounts.arbitration}`,
    `  Employer count: ${ctx.employerCount}`,
    `  Compliance alerts (period): ${ctx.alertCount}`,
    '',
    'Return JSON: {',
    '  title: string,',
    '  summary: string,',
    '  insights: [{ label, value (number | string), trend (up|down|stable), severity (info|warning|critical), description }],',
    '  predictions: [{ metric, currentValue, predictedValue, lowerBound, upperBound, horizon }],',
    '  recommendations: [{ action, priority (low|medium|high), impact, effort }],',
    '  dataSourcesUsed: string[],',
    '  confidence: number (0-1),',
    '  explanation: string',
    '}',
    '',
    'Respond ONLY with valid JSON.',
  ].join('\n');
}

function parseInsightResponse(
  raw: string,
  reportType: InsightReportType,
  timeframe: InsightTimeframe,
): { result: InsightResult; confidence: number; explanation: string } {
  try {
    const json = JSON.parse(raw);
    return {
      result: {
        reportType,
        timeframe,
        title: String(json.title ?? `${reportType} report`),
        summary: String(json.summary ?? ''),
        insights: Array.isArray(json.insights) ? json.insights : [],
        predictions: Array.isArray(json.predictions) ? json.predictions : [],
        recommendations: Array.isArray(json.recommendations) ? json.recommendations : [],
        dataSourcesUsed: Array.isArray(json.dataSourcesUsed) ? json.dataSourcesUsed : [],
      },
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      explanation: String(json.explanation ?? 'AI-generated insight report.'),
    };
  } catch {
    logger.warn('Failed to parse executive insights AI response');
    return {
      result: {
        reportType,
        timeframe,
        title: `${reportType} report (parse error)`,
        summary: 'Unable to parse AI response. Manual analysis recommended.',
        insights: [],
        predictions: [],
        recommendations: [],
        dataSourcesUsed: [],
      },
      confidence: 0.2,
      explanation: 'AI response could not be parsed.',
    };
  }
}
