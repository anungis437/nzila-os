/**
 * GET /api/ai/pension/members/[id]/projection
 * AI-powered benefit projection for a pension member at a target retirement age.
 *
 * Returns conservative/base/optimistic scenarios based on the member's
 * contribution history and years of service.
 *
 * RBAC:         officer (financial data; stewards/members do not have
 *               unrestricted access to actuarial projections for other members)
 * Feature flag: AI_FEATURES.PENSION_BENEFIT_PROJECTION
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 *
 * Query params:
 *   targetRetirementAge  integer, 55–75 (required)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { projectMemberBenefit } from '@/lib/ai/pension-intelligence';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

const projectionQuerySchema = z.object({
  targetRetirementAge: z.coerce.number().int().min(55).max(75),
});

export const GET = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-pension-projection:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  // 2. Feature gate
  const blocked = await guardAiFeature(AI_FEATURES.PENSION_BENEFIT_PROJECTION, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);

  // 4. Validate query params
  const parsed = projectionQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'targetRetirementAge is required (integer, 55–75)',
      parsed.error.flatten(),
    );
  }

  // 5. Execute
  const memberId = request.nextUrl.pathname.split('/').at(-2) ?? '';
  try {
    const result = await projectMemberBenefit({
      memberId,
      organizationId: context.organizationId!,
      userId: context.userId!,
      targetRetirementAge: parsed.data.targetRetirementAge,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Benefit projection failed.');
  }
});
