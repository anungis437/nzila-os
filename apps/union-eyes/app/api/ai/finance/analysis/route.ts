/**
 * GET /api/ai/finance/analysis
 * AI-generated financial intelligence report.
 *
 * Query params:
 *   type       'collection_health' | 'arrears_risk' | 'budget_variance' |
 *              'remittance_trends' | 'comprehensive'  (default: 'comprehensive')
 *   timeframe  '30d' | '60d' | '90d' | '6m' | '12m'  (default: '90d')
 *
 * RBAC:         officer
 * Feature flag: AI_FEATURES.FINANCIAL_ANALYSIS
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 */

import { withApi, ApiError, z, RATE_LIMITS } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { enforceAISafety } from '@nzila/policies';
import {
  generateFinancialInsight,
  type FinancialAnalysisType,
  type FinancialTimeframe,
} from '@/lib/ai/financial-insights';

const querySchema = z.object({
  type: z.enum(['collection_health', 'arrears_risk', 'budget_variance', 'remittance_trends', 'comprehensive']).default('comprehensive'),
  timeframe: z.enum(['30d', '60d', '90d', '6m', '12m']).default('90d'),
});

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    rateLimit: RATE_LIMITS.AI_COMPLETION,
    query: querySchema,
    openapi: {
      tags: ['AI', 'Finance'],
      summary: 'AI-generated financial intelligence report',
    },
  },
  async ({ organizationId, userId, query }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.unauthorized('User context required');

    // Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.FINANCIAL_ANALYSIS, {
      userId,
      organizationId,
    });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'finance-analysis', action: 'GET', organizationId, userId: userId ?? '', userRole: 'officer', dataClass: 'confidential' });

    const result = await generateFinancialInsight({
      analysisType: query.type as FinancialAnalysisType,
      timeframe: query.timeframe as FinancialTimeframe,
      organizationId,
      userId,
    });
    return { ...result };
  },
);
