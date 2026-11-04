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

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { projectMemberBenefit } from '@/lib/ai/pension-intelligence';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { financeViewMandateDenial } from '@/lib/finance/finance-view-mandate';

const projectionQuerySchema = z.object({
  targetRetirementAge: z.coerce.number().int().min(55).max(75),
});

// The helper reads the member and the contributions in the organization's own context and ends that transaction before the provider is called, so the
// route does not set `rlsOrgContext`. The entitlement is checked by the wrapper.
export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI benefit projection for one pension member (advisory)' },
  },
  async ({ request, user, userId, organizationId, params }) => {
    // 0. A live mandate must cover this particular pension member (or the organization ledger).
    const memberId = z.guid().safeParse(params.id);
    if (!memberId.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Pension member identifier is required');
    const noMandate = await financeViewMandateDenial(organizationId!, userId!, memberId.data);
    if (noMandate) return noMandate;

    // 1. Rate limit
    const rl = await checkRateLimit(`ai-pension-projection:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.PENSION_BENEFIT_PROJECTION, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    // 3. AI safety
    enforceAISafety({ origin: 'pension-projection', action: 'GET', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'officer', dataClass: 'pension_financial' });

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
    try {
      const result = await projectMemberBenefit({
        memberId: memberId.data,
        organizationId: organizationId!,
        userId: userId!,
        targetRetirementAge: parsed.data.targetRetirementAge,
      });
      return standardSuccessResponse(result);
    } catch (_error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Benefit projection failed.');
    }
  },
);
