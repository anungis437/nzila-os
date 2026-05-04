/**
 * AI Insights Summary
 *
 * GET /api/ai/insights/summary → Get a summary across all insight types
 *
 * Feature-gated: AI_EXECUTIVE_INSIGHTS
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { getInsightReports } from '@/lib/ai/executive-insights';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { auditAIInvocation } from '@/lib/audit-logger';

export const GET = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  const rl = await checkRateLimit(`ai-insights-summary:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  const blocked = await guardAiFeature(AI_FEATURES.EXECUTIVE_INSIGHTS, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  try {
    await requireEntitlement(context.organizationId!, 'ai_advanced_insights');
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  enforceAISafety({ origin: 'ai-insights-summary', action: 'GET', organizationId: context.organizationId!, userId: context.userId!, userRole: context.userRole as string, dataClass: 'confidential' });

  try {
    const [trends, hotspots, capacity, escalations, summaries] = await Promise.all([
      getInsightReports(context.organizationId!, 'trend_forecast', 1),
      getInsightReports(context.organizationId!, 'employer_hotspots', 1),
      getInsightReports(context.organizationId!, 'steward_capacity', 1),
      getInsightReports(context.organizationId!, 'arbitration_escalation', 1),
      getInsightReports(context.organizationId!, 'executive_summary', 1),
    ]);

    const auditRefId = await auditAIInvocation({
      userId: context.userId,
      organizationId: context.organizationId,
      origin: 'ai-insights-summary',
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
      dataClass: 'confidential',
    });

    return standardSuccessResponse({
      latestTrendForecast: trends[0] ?? null,
      latestEmployerHotspots: hotspots[0] ?? null,
      latestStewardCapacity: capacity[0] ?? null,
      latestArbitrationEscalation: escalations[0] ?? null,
      latestExecutiveSummary: summaries[0] ?? null,
    }, {
      aiGenerated: true,
      reviewRequired: true,
      source: 'ai',
      model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
      timestamp: new Date().toISOString(),
      auditRefId,
    });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch insight summary',
    );
  }
});
