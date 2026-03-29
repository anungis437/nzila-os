/**
 * AI Grievance Triage — Per-Grievance
 *
 * GET  /api/ai/grievances/[id]/triage  → Get triage history for a grievance
 * POST /api/ai/grievances/[id]/triage  → Generate new triage for a specific grievance
 * PATCH /api/ai/grievances/[id]/triage → Review (accept/reject) a triage result
 *
 * Feature-gated: AI_GRIEVANCE_TRIAGE
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { analyzeGrievance, getTriageHistory, reviewTriage } from '@/lib/ai/grievance-triage';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';

const reviewSchema = z.object({
  triageId: z.string().uuid(),
  accept: z.boolean(),
  notes: z.string().optional(),
});

export const GET = withRoleAuth('steward', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance id');

  const history = await getTriageHistory(id, context.organizationId!);
  return standardSuccessResponse(history);
});

export const POST = withRoleAuth('steward', async (_request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const id = (context.params as Record<string, string>)?.id;
  if (!id) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance id');

  try {
    const result = await analyzeGrievance({
      grievanceId: id,
      organizationId: context.organizationId!,
      userId: context.userId!,
    });
    return standardSuccessResponse(result);
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Triage failed',
    );
  }
});

export const PATCH = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  const blocked = await guardAiFeature(AI_FEATURES.GRIEVANCE_TRIAGE, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  const body = await request.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid review input', parsed.error.flatten());
  }

  await reviewTriage(
    parsed.data.triageId,
    context.organizationId!,
    context.userId!,
    parsed.data.accept,
    parsed.data.notes,
  );

  return standardSuccessResponse({ reviewed: true, accepted: parsed.data.accept });
});
