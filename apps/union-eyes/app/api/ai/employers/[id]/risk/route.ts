/**
 * GET /api/ai/employers/[id]/risk
 * AI-powered employer risk assessment.
 *
 * Aggregates grievance frequency, compliance alerts, dispatch non-compliance,
 * and arbitration history to produce a risk score + band for the employer.
 *
 * RBAC:         steward (frontline role that acts on risk signals)
 * Feature flag: AI_FEATURES.EMPLOYER_RISK
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { calculateEmployerRisk } from '@/lib/ai/employer-risk';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

export const GET = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-employer-risk:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  // 2. Feature gate
  const blocked = await guardAiFeature(AI_FEATURES.EMPLOYER_RISK, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);

  // 4. Execute
  const employerId = request.nextUrl.pathname.split('/').at(-2) ?? '';
  try {
    const result = await calculateEmployerRisk({
      employerId,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Employer risk assessment failed.');
  }
});
