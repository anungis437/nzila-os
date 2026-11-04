/**
 * Steward Continuity Cognition — Query Endpoint
 *
 * POST /api/ai/copilot/query → Execute a bounded institutional cognition action
 * GET  /api/ai/copilot/history → Get cognition session history
 *
 * Feature-gated: AI_STEWARD_COPILOT
 * All outputs are advisory and require human steward confirmation.
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { executeCopilotAction, getCopilotHistory } from '@/lib/ai/steward-copilot';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { auditAIInvocation } from '@/lib/audit-logger';
import { operationAuditResponse } from '@/lib/audit/operation-audit';

const copilotSchema = z.object({
  actionType: z.enum(['timeline_summary', 'suggest_action', 'draft_response', 'explain_clause', 'risk_brief', 'custom_query']),
  relatedEntityType: z.string().max(100).optional(),
  relatedEntityId: z.guid().optional(),
  query: z.string().max(5000).optional(),
});

// The helpers read the grievance and the history in the organization's own context and end those transactions before the provider is called, so the
// routes do not set `rlsOrgContext`. The entitlement and the body are checked by the wrapper.
export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'ai_advanced_insights',
    body: copilotSchema,
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Run a steward copilot action (advisory)' },
  },
  async ({ user, userId, organizationId, body }) => {
    // Rate limit
    const rl = await checkRateLimit(`ai-copilot:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded.');
    }

    const blocked = await guardAiFeature(AI_FEATURES.STEWARD_COPILOT, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'copilot-query', action: 'POST', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'steward', dataClass: 'internal' });

    try {
      const result = await executeCopilotAction({
        organizationId: organizationId!,
        userId: userId!,
        userRole: 'steward', // derived from RBAC
        ...body,
      });
      const auditRefId = await auditAIInvocation({
        userId: userId!,
        organizationId: organizationId!,
        origin: 'copilot-query',
        model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
        dataClass: 'internal',
      });
      return standardSuccessResponse(result, {
        aiGenerated: true,
        reviewRequired: true,
        source: 'ai',
        model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',
        timestamp: new Date().toISOString(),
        auditRefId,
      });
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return standardErrorResponse(ErrorCode.CONFLICT, refused.body.error.message);
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Copilot query failed',
      );
    }
  },
);

export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'The signed-in steward\'s copilot session history' },
  },
  async ({ user, userId, organizationId }) => {
    const blocked = await guardAiFeature(AI_FEATURES.STEWARD_COPILOT, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'copilot-query', action: 'GET', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'steward', dataClass: 'internal' });

    const history = await getCopilotHistory(userId!, organizationId!);
    return standardSuccessResponse(history);
  },
);
