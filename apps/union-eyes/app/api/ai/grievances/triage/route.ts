/**
 * AI Grievance Triage API
 *
 * POST /api/ai/grievances/triage
 *   Body: { grievanceId: string }
 *   → AI-generated triage recommendation (priority, category, complexity)
 *
 * Feature-gated: AI_GRIEVANCE_TRIAGE
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzeGrievance } from '@/lib/ai/grievance-triage';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { operationAuditResponse } from '@/lib/audit/operation-audit';

const triageSchema = z.object({
  grievanceId: z.guid(),
});

// The helper reads the grievance in the organization's own context and ends that transaction before the provider is called, so the route does not set
// `rlsOrgContext`. The entitlement and the body are checked by the wrapper.
export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'ai_advanced_insights',
    body: triageSchema,
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI triage of one grievance (advisory)' },
  },
  async ({ user, userId, organizationId, body }) => {
    // 1. Rate limit
    const rl = await checkRateLimit(`ai-triage:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    // 3. AI Safety
    enforceAISafety({ origin: 'grievance-triage', action: 'POST', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'steward', dataClass: 'grievance_legal' });

    // 4. Execute
    try {
      const result = await analyzeGrievance({
        grievanceId: body.grievanceId,
        organizationId: organizationId!,
        userId: userId!,
      });
      return standardSuccessResponse(result);
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return standardErrorResponse(ErrorCode.CONFLICT, refused.body.error.message);
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Triage analysis failed',
      );
    }
  },
);
