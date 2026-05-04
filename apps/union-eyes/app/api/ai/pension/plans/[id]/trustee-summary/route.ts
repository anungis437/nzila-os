/**
 * POST /api/ai/pension/plans/[id]/trustee-summary
 * AI-generated plain-language trustee summary for a pension plan.
 *
 * Accepts an optional actuarial valuation document extract in the request body.
 * Returns key findings, required actions, regulatory notes, and a member-impact
 * summary suitable for the trustee portal dashboard.
 *
 * RBAC:         officer (trustee-level; financial/actuarial content)
 * Feature flag: AI_FEATURES.PENSION_TRUSTEE_SUMMARY
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 *
 * Body (optional):
 *   { valuationDocumentText?: string }  — max 10 000 chars of raw document text
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { summarizeTrusteeReport } from '@/lib/ai/pension-intelligence';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

const trusteeSummarySchema = z.object({
  valuationDocumentText: z.string().max(10_000).optional(),
});

export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  // 1. Rate limit
  const rl = await checkRateLimit(`ai-pension-trustee:${context.userId}`, RATE_LIMITS.AI_COMPLETION);
  if (!rl.allowed) {
    return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
  }

  // 2. Feature gate
  const blocked = await guardAiFeature(AI_FEATURES.PENSION_TRUSTEE_SUMMARY, {
    userId: context.userId,
    organizationId: context.organizationId,
  });
  if (blocked) return blocked;

  // 3. Entitlement
  await requireEntitlement(context.organizationId!, 'ai_advanced_insights', context.userId);
  enforceAISafety({ origin: 'pension-trustee-summary', action: 'POST', organizationId: context.organizationId!, userId: context.userId!, userRole: context.userRole as string, dataClass: 'pension_financial' });

  // 4. Validate body
  let bodyData: { valuationDocumentText?: string } = {};
  try {
    const rawBody = await request.json();
    const parsed = trusteeSummarySchema.safeParse(rawBody);
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request body',
        parsed.error.flatten(),
      );
    }
    bodyData = parsed.data;
  } catch {
    // Empty body is acceptable — valuation text is optional
  }

  // 5. Execute
  const planId = request.nextUrl.pathname.split('/').at(-2) ?? '';
  try {
    const result = await summarizeTrusteeReport({
      planId,
      organizationId: context.organizationId!,
      userId: context.userId!,
      valuationDocumentText: bodyData.valuationDocumentText,
    });
    return standardSuccessResponse(result);
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Trustee summary generation failed.');
  }
});
