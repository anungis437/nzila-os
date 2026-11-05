/**
 * AI Insights Summary
 *
 * GET /api/ai/insights/summary → Get a summary across all insight types
 *
 * Feature-gated: AI_EXECUTIVE_INSIGHTS
 */

import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { getLatestInsightReports } from '@/lib/ai/executive-insights';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { auditAIInvocation } from '@/lib/audit-logger';

// The reports are read in the organization's own context by the helper (one transaction, no provider call inside it); the entitlement is checked by the wrapper.
export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Latest executive insight report of each type' },
  },
  async ({ user, userId, organizationId }) => {
    const rl = await checkRateLimit(`ai-insights-summary:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    const blocked = await guardAiFeature(AI_FEATURES.EXECUTIVE_INSIGHTS, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'ai-insights-summary', action: 'GET', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'officer', dataClass: 'confidential' });

    try {
      const latest = await getLatestInsightReports(organizationId!);

      const auditRefId = await auditAIInvocation({
        userId: userId!,
        organizationId: organizationId!,
        origin: 'ai-insights-summary',
        model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
        dataClass: 'confidential',
      });

      return standardSuccessResponse({
        latestTrendForecast: latest.trendForecast,
        latestEmployerHotspots: latest.employerHotspots,
        latestStewardCapacity: latest.stewardCapacity,
        latestArbitrationEscalation: latest.arbitrationEscalation,
        latestExecutiveSummary: latest.executiveSummary,
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
  },
);
