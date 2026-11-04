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

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzeGrievance } from '@/lib/ai/grievance-triage';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { operationAuditResponse } from '@/lib/audit/operation-audit';

// The helper reads the grievance in the organization's own context and ends that transaction before the provider is called, so the route does not set
// `rlsOrgContext`. The entitlement is checked by the wrapper.
export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI triage of one grievance (advisory)' },
  },
  async ({ user, userId, organizationId, params }) => {
    // 1. Rate limit
    const rl = await checkRateLimit(`ai-triage-id:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'grievance-triage-id', action: 'POST', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'steward', dataClass: 'grievance_legal' });

    // 3. Execute — grievance ID comes from the URL, no body parameters needed
    const grievanceId = z.guid().safeParse(params.id);
    if (!grievanceId.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid grievance ID');
    }
    try {
      const result = await analyzeGrievance({
        grievanceId: grievanceId.data,
        organizationId: organizationId!,
        userId: userId!,
      });
      return standardSuccessResponse(result);
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return standardErrorResponse(ErrorCode.CONFLICT, refused.body.error.message);
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Grievance triage failed.');
    }
  },
);
