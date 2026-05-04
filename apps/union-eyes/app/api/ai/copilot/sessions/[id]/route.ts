/**
 * AI Copilot Session Outcome
 *
 * PATCH /api/ai/copilot/sessions/[id] → Record accept/reject/edit for a copilot session
 *
 * Feature-gated: AI_STEWARD_COPILOT
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { recordCopilotOutcome } from '@/lib/ai/steward-copilot';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { logAiActionTaken } from '@/lib/audit-logger';

const outcomeSchema = z.object({
  outcome: z.enum(['accepted', 'edited', 'rejected']),
  editedResponse: z.string().optional(),
  feedbackRating: z.number().min(1).max(5).optional(),
  feedbackNotes: z.string().max(2000).optional(),
});

export const PATCH = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  // Rate limit
  const rl = await checkRateLimit(`ai-copilot-session:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded.');

  const blocked = await guardAiFeature(AI_FEATURES.STEWARD_COPILOT, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  await requireEntitlement(context.organizationId!, 'ai_advanced_insights');
  enforceAISafety({ origin: 'copilot-session', action: 'PATCH', organizationId: context.organizationId!, userId: context.userId!, userRole: context.userRole as string, dataClass: 'internal' });

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing session id');

  const body = await request.json();
  const parsed = outcomeSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid outcome', parsed.error.flatten());
  }

  await recordCopilotOutcome(
    id,
    context.organizationId!,
    parsed.data.outcome,
    parsed.data.editedResponse,
    parsed.data.feedbackRating,
    parsed.data.feedbackNotes,
  );

  // Emit AI_ACTION_TAKEN for full user→AI output traceability chain
  await logAiActionTaken({
    userId: context.userId!,
    organizationId: context.organizationId!,
    aiReferenceId: id,
    actionType: parsed.data.outcome === 'accepted' ? 'accept'
      : parsed.data.outcome === 'edited' ? 'modify'
      : 'reject',
    entityType: 'recommendation',
    entityId: id,
  });

  return standardSuccessResponse({ sessionId: id, ...parsed.data });
});
