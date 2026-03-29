/**
 * AI Clause Reasoning — Per-Grievance
 *
 * POST /api/ai/grievances/[id]/clause-reasoning → Suggest clauses for a grievance
 * GET  /api/ai/grievances/[id]/clause-reasoning → Get clause reasoning history
 *
 * Feature-gated: AI_CLAUSE_REASONING
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { suggestClausesForGrievance, explainClauseRelevance, getClauseReasoningHistory } from '@/lib/ai/clause-reasoning';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';

const explainSchema = z.object({
  clauseArticle: z.string().min(1),
});

export const GET = withRoleAuth('steward', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.CLAUSE_REASONING, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance id');

  const history = await getClauseReasoningHistory(id, context.organizationId!);
  return standardSuccessResponse(history);
});

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.CLAUSE_REASONING, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance id');

  // Check if body has clauseArticle → explain specific clause, otherwise suggest all
  const body = await request.json().catch(() => ({}));
  const explainParsed = explainSchema.safeParse(body);

  try {
    if (explainParsed.success) {
      const result = await explainClauseRelevance(
        id,
        explainParsed.data.clauseArticle,
        context.organizationId!,
        context.userId!,
      );
      return standardSuccessResponse(result);
    }

    const result = await suggestClausesForGrievance({
      grievanceId: id,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Clause reasoning failed',
    );
  }
});
