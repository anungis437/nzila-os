/**
 * AI Steward Copilot
 *
 * POST /api/ai/copilot/query → Execute a copilot action
 * GET  /api/ai/copilot/history → Get copilot session history
 *
 * Feature-gated: AI_STEWARD_COPILOT
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { executeCopilotAction, getCopilotHistory } from '@/lib/ai/steward-copilot';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders as _createRateLimitHeaders } from '@/lib/rate-limiter';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

const copilotSchema = z.object({
  actionType: z.enum(['timeline_summary', 'suggest_action', 'draft_response', 'explain_clause', 'risk_brief', 'custom_query']),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().uuid().optional(),
  query: z.string().max(5000).optional(),
});

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  // Rate limit
  const rl = await checkRateLimit(`ai-copilot:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded.');
  }

  const blocked = await guardAiFeature(AI_FEATURES.STEWARD_COPILOT, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  await requireEntitlement(context.organizationId!, 'ai_advanced_insights');

  const body = await request.json();
  const parsed = copilotSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid copilot input', parsed.error.flatten());
  }

  try {
    const result = await executeCopilotAction({
      organizationId: context.organizationId!,
      userId: context.userId!,
      userRole: 'steward', // derived from RBAC
      ...parsed.data,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Copilot query failed',
    );
  }
});

export const GET = withRoleAuth('steward', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.STEWARD_COPILOT, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  await requireEntitlement(context.organizationId!, 'ai_advanced_insights');

  const history = await getCopilotHistory(context.userId!, context.organizationId!);
  return standardSuccessResponse(history);
});
