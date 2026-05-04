/**
 * AI Grievance Triage API
 *
 * POST /api/ai/grievances/triage
 *   Body: { grievanceId: string }
 *   → AI-generated triage recommendation (priority, category, complexity)
 *
 * Feature-gated: AI_GRIEVANCE_TRIAGE
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzeGrievance } from '@/lib/ai/grievance-triage';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders as _createRateLimitHeaders } from '@/lib/rate-limiter';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { enforceAISafety } from '@nzila/policies';

const triageSchema = z.object({
  grievanceId: z.string().uuid(),
});

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-triage:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  // 2. Feature gate
  const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  // 3. Entitlement (billing gate)
  try {
    await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  // 4. AI Safety
  enforceAISafety({ origin: 'grievance-triage', action: 'POST', organizationId: context.organizationId!, userId: context.userId!, userRole: context.userRole as string, dataClass: 'grievance_legal' });

  // 5. Validate
  const body = await request.json();
  const parsed = triageSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error.flatten());
  }

  // 4. Execute
  try {
    const result = await analyzeGrievance({
      grievanceId: parsed.data.grievanceId,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Triage analysis failed',
    );
  }
});
