/**
 * GET /api/ai/insights/[reportType]
 * AI-generated executive insight report for the given report type.
 *
 * reportType: trend_forecast | employer_hotspots | steward_capacity |
 *             arbitration_escalation | executive_summary
 *
 * Query params:
 *   timeframe  '30d' | '60d' | '90d' | '6m' | '12m'  (default: '90d')
 *
 * RBAC:         officer
 * Feature flag: AI_FEATURES.EXECUTIVE_INSIGHTS
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import {
  generateInsightReport,
  type InsightReportType,
  type InsightTimeframe,
} from '@/lib/ai/executive-insights';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

const VALID_REPORT_TYPES: InsightReportType[] = [
  'trend_forecast',
  'employer_hotspots',
  'steward_capacity',
  'arbitration_escalation',
  'executive_summary',
];

const querySchema = z.object({
  timeframe: z.enum(['30d', '60d', '90d', '6m', '12m']).default('90d'),
});

// The helper reads the organization's counts in its own context and ends that transaction before the provider is called, so the route does not set
// `rlsOrgContext`. The entitlement is checked by the wrapper.
export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Generate an executive insight report' },
  },
  async ({ request, user, userId, organizationId, params }) => {
    // 1. Rate limit
    const rl = await checkRateLimit(`ai-insights:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Validate reportType path segment
    const reportType = params.reportType as InsightReportType;
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Invalid reportType. Must be one of: ${VALID_REPORT_TYPES.join(', ')}`,
      );
    }

    // 3. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.EXECUTIVE_INSIGHTS, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    // 4. AI safety
    enforceAISafety({ origin: 'ai-insights', action: 'GET', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'officer', dataClass: 'confidential' });

    // 5. Parse query params
    const parsed = querySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid timeframe',
        parsed.error.flatten(),
      );
    }

    // 6. Execute
    try {
      const result = await generateInsightReport({
        reportType,
        timeframe: parsed.data.timeframe as InsightTimeframe,
        organizationId: organizationId!,
        userId: userId!,
      });
      return standardSuccessResponse(result);
    } catch (_error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Insight report generation failed.');
    }
  },
);
