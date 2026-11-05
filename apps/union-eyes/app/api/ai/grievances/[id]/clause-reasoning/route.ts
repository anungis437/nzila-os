/**
 * POST /api/ai/grievances/[id]/clause-reasoning
 * AI-powered clause reasoning analysis for a specific grievance.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { suggestClausesForGrievance } from '@/lib/ai/clause-reasoning';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { operationAuditResponse } from '@/lib/audit/operation-audit';

// The helper reads the grievance in the organization's own context and ends that transaction before the provider is called, so the route does not set
// `rlsOrgContext`. The entitlement is checked by the wrapper.
export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'grievance_case_suite',
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI clause reasoning for one grievance (advisory)' },
  },
  async ({ userId, organizationId, params }) => {
    const id = z.guid().safeParse(params.id);
    if (!id.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid grievance ID');
    }

    // Rate limit
    const rl = await checkRateLimit(`ai-clause-reasoning:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded.');

    const blocked = await guardAiFeature(AI_FEATURES.CLAUSE_REASONING, {
      organizationId: organizationId!,
      userId: userId ?? '',
    });
    if (blocked) return blocked;

    enforceAISafety({ origin: 'clause-reasoning', action: 'POST', organizationId: organizationId!, userId: userId ?? '', userRole: 'steward', dataClass: 'grievance_legal' });

    try {
      const result = await suggestClausesForGrievance({
        grievanceId: id.data,
        organizationId: organizationId!,
        userId: userId ?? '',
      });

      return NextResponse.json(result);
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return standardErrorResponse(ErrorCode.CONFLICT, refused.body.error.message);
      throw error;
    }
  },
);
