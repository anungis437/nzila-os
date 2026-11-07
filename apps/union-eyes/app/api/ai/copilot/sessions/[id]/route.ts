/**
 * AI Copilot Session Outcome
 *
 * PATCH /api/ai/copilot/sessions/[id] → Record accept/reject/edit for a copilot session
 *
 * Feature-gated: AI_STEWARD_COPILOT
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { recordCopilotOutcome } from '@/lib/ai/steward-copilot';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { logAiActionTaken } from '@/lib/audit-logger';

const outcomeSchema = z.object({
  outcome: z.enum(['accepted', 'edited', 'rejected']),
  editedResponse: z.string().max(20_000).optional(),
  feedbackRating: z.number().min(1).max(5).optional(),
  feedbackNotes: z.string().max(2000).optional(),
});

// `recordCopilotOutcome` decides the session and writes its audit record in one tenant transaction; the entitlement and the body are checked by the wrapper.
export const PATCH = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'ai_advanced_insights',
    body: outcomeSchema,
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Record the outcome of a copilot session' },
  },
  async ({ user, userId, organizationId, params, body }) => {
    // Rate limit
    const rl = await checkRateLimit(`ai-copilot-session:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded.');

    const blocked = await guardAiFeature(AI_FEATURES.STEWARD_COPILOT, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'copilot-session', action: 'PATCH', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'steward', dataClass: 'grievance_legal' });

    const id = z.guid().safeParse(params.id);
    if (!id.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing session id');

    const recorded = await recordCopilotOutcome(
      id.data,
      organizationId!,
      userId!,
      body.outcome,
      body.editedResponse,
      body.feedbackRating,
      body.feedbackNotes,
    );
    if (recorded === 'not_found') {
      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Copilot session not found');
    }
    if (recorded === 'already_decided') {
      return standardErrorResponse(ErrorCode.CONFLICT, 'An outcome has already been recorded for this session');
    }

    // Emit AI_ACTION_TAKEN for full user→AI output traceability chain
    await logAiActionTaken({
      userId: userId!,
      organizationId: organizationId!,
      aiReferenceId: id.data,
      actionType: body.outcome === 'accepted' ? 'accept'
        : body.outcome === 'edited' ? 'modify'
        : 'reject',
      entityType: 'recommendation',
      targetEntityId: id.data,
    });

    return standardSuccessResponse({ sessionId: id.data, ...body });
  },
);
