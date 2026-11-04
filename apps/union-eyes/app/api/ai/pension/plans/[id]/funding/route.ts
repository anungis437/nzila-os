/**
 * GET /api/ai/pension/plans/[id]/funding
 * AI-powered pension funding analysis for trustees.
 *
 * Interprets funding ratio, identifies underfunding risk bands, and produces
 * trustee-level recommendations backed by the plan's current metrics.
 *
 * RBAC:         officer (trustees, executives — not stewards or members)
 * Feature flag: AI_FEATURES.PENSION_FUNDING_ANALYSIS
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzePensionFunding } from '@/lib/ai/pension-intelligence';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { financeViewMandateDenial } from '@/lib/finance/finance-view-mandate';

// The helper reads the plan in the organization's own context and ends that transaction before the provider is called, so the route does not set
// `rlsOrgContext`. The entitlement is checked by the wrapper.
export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI funding analysis of one pension plan (advisory)' },
  },
  async ({ user, userId, organizationId, params }) => {
    // 0. A live mandate must cover this particular pension plan (or the organization ledger).
    const planId = z.guid().safeParse(params.id);
    if (!planId.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Pension plan identifier is required');
    const noMandate = await financeViewMandateDenial(organizationId!, userId!, planId.data);
    if (noMandate) return noMandate;

    // 1. Rate limit
    const rl = await checkRateLimit(`ai-pension-funding:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.PENSION_FUNDING_ANALYSIS, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    // 3. AI safety
    enforceAISafety({ origin: 'pension-funding', action: 'GET', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'officer', dataClass: 'pension_financial' });

    // 4. Execute
    try {
      const result = await analyzePensionFunding({
        planId: planId.data,
        organizationId: organizationId!,
        userId: userId!,
      });
      return standardSuccessResponse(result);
    } catch (_error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Pension funding analysis failed.');
    }
  },
);
