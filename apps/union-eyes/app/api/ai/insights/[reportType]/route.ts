/**
 * AI Executive Insights
 *
 * POST /api/ai/insights/[reportType] → Generate an insight report
 * GET  /api/ai/insights/[reportType] → Get past reports of this type
 *
 * Feature-gated: AI_EXECUTIVE_INSIGHTS
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { generateInsightReport, getInsightReports, type InsightReportType, type InsightTimeframe } from '@/lib/ai/executive-insights';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const validReportTypes: InsightReportType[] = [
  'trend_forecast',
  'employer_hotspots',
  'steward_capacity',
  'arbitration_escalation',
  'executive_summary',
];

const generateSchema = z.object({
  timeframe: z.enum(['30d', '60d', '90d', '6m', '12m']).default('90d'),
});

export const GET = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.EXECUTIVE_INSIGHTS, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  await requireEntitlement(context.organizationId!, 'ai_advanced_insights');

  const reportType = (context.params as Record<string, string>)?.reportType as InsightReportType;
  if (!validReportTypes.includes(reportType)) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, `Invalid report type: ${reportType}`);
  }

  const reports = await getInsightReports(context.organizationId!, reportType);
  return standardSuccessResponse(reports);
});

export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.EXECUTIVE_INSIGHTS, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  await requireEntitlement(context.organizationId!, 'ai_advanced_insights');

  const reportType = (context.params as Record<string, string>)?.reportType as InsightReportType;
  if (!validReportTypes.includes(reportType)) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, `Invalid report type: ${reportType}`);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = generateSchema.safeParse(body);
  const timeframe: InsightTimeframe = parsed.success ? parsed.data.timeframe : '90d';

  try {
    const result = await generateInsightReport({
      reportType,
      timeframe,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Insight generation failed',
    );
  }
});
