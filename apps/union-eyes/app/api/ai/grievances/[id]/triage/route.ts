/**
 * POST /api/ai/grievances/[id]/triage
 * AI-powered triage for a specific grievance by ID.
 *
 * Analyses the grievance and returns a recommended priority, category,
 * complexity band, similar precedents, and suggested next step.
 * Results are ADVISORY — requiresHumanConfirmation is always true.
 *
 * RBAC:         steward
 * Feature flag: AI_FEATURES.GRIEVANCE_TRIAGE
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzeGrievance } from '@/lib/ai/grievance-triage';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-triage-id:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  // 2. Feature gate
  const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);

  // 4. Execute — grievance ID comes from the URL, no body parameters needed
  const grievanceId = request.nextUrl.pathname.split('/').at(-2) ?? '';
  try {
    const result = await analyzeGrievance({
      grievanceId,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Grievance triage failed.');
  }
});
