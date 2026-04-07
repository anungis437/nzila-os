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

export const GET = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  // Rate limit — AI_COMPLETION is the most expensive tier (20/hr per user)
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

  try {
    // Fetch latest report for each type
    const [trends, hotspots, capacity, escalations, summaries] = await Promise.all([
      getInsightReports(context.organizationId!, 'trend_forecast', 1),
      getInsightReports(context.organizationId!, 'employer_hotspots', 1),
      getInsightReports(context.organizationId!, 'steward_capacity', 1),
      getInsightReports(context.organizationId!, 'arbitration_escalation', 1),
      getInsightReports(context.organizationId!, 'executive_summary', 1),
    ]);

    return standardSuccessResponse({
      latestTrendForecast: trends[0] ?? null,
      latestEmployerHotspots: hotspots[0] ?? null,
      latestStewardCapacity: capacity[0] ?? null,
      latestArbitrationEscalation: escalations[0] ?? null,
      latestExecutiveSummary: summaries[0] ?? null,
    });
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch insight summary',
    );
  }
});
