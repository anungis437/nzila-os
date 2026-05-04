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

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzePensionFunding } from '@/lib/ai/pension-intelligence';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

export const GET = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-pension-funding:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  // 2. Feature gate
  const blocked = await guardAiFeature(AI_FEATURES.PENSION_FUNDING_ANALYSIS, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);
  enforceAISafety({ origin: 'pension-funding', action: 'GET', organizationId: context.organizationId!, userId: context.userId!, userRole: context.userRole as string, dataClass: 'pension_financial' });

  // 4. Execute
  const planId = request.nextUrl.pathname.split('/').at(-2) ?? '';
  try {
    const result = await analyzePensionFunding({
      planId,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Pension funding analysis failed.');
  }
});
