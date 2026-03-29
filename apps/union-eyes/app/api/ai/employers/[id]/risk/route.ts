/**
 * AI Employer Risk Scoring
 *
 * POST /api/ai/employers/[id]/risk → Calculate risk for an employer
 * GET  /api/ai/employers/[id]/risk → Get latest + history
 *
 * Feature-gated: AI_EMPLOYER_RISK
 */

import { NextRequest } from 'next/server';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { calculateEmployerRisk, getLatestRiskScore, getRiskHistory } from '@/lib/ai/employer-risk';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';

export const GET = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.EMPLOYER_RISK, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing employer id');

  const latest = await getLatestRiskScore(id, context.organizationId!);
  const history = await getRiskHistory(id, context.organizationId!);

  return standardSuccessResponse({ latest, history });
});

export const POST = withRoleAuth('officer', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.EMPLOYER_RISK, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing employer id');

  try {
    const result = await calculateEmployerRisk({
      employerId: id,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Risk scoring failed',
    );
  }
});
