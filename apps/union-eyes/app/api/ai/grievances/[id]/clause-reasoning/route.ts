/**
 * POST /api/ai/grievances/[id]/clause-reasoning
 * AI-powered clause reasoning analysis for a specific grievance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { standardErrorResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { suggestClausesForGrievance } from '@/lib/ai/clause-reasoning';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  const { userId, organizationId } = context;

  if (!organizationId) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
  }

  const id = request.nextUrl.pathname.split('/').at(-2) ?? '';
  if (!id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Grievance ID required');
  }

  // Rate limit
  const rl = await checkRateLimit(`ai-clause-reasoning:${userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded.');

  const blocked = await guardAiFeature(AI_FEATURES.CLAUSE_REASONING, {
    organizationId: organizationId!,
    userId: userId ?? '',
  });
  if (blocked) return blocked;

  try {
    await requireEntitlement(organizationId!, 'grievance_case_suite');
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  enforceAISafety({ origin: 'clause-reasoning', action: 'POST', organizationId: organizationId!, userId: userId ?? '', userRole: 'steward', dataClass: 'grievance_legal' });

  const result = await suggestClausesForGrievance({
    grievanceId: id,
    organizationId,
    userId: userId ?? '',
  });

  return NextResponse.json(result);
});
