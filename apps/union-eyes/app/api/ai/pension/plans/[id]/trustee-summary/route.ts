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

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { summarizeTrusteeReport } from '@/lib/ai/pension-intelligence';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';
import { financeViewMandateDenial } from '@/lib/finance/finance-view-mandate';

const trusteeSummarySchema = z.object({
  valuationDocumentText: z.string().max(10_000).optional(),
});

// The helper reads the plan in the organization's own context and ends that transaction before the provider is called, so the route does not set
// `rlsOrgContext`. The entitlement is checked by the wrapper.
export const POST = withApi(
  {
    auth: { minRole: 'officer' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI trustee summary of one pension plan (advisory)' },
  },
  async ({ request, user, userId, organizationId, params }) => {
    // 0. A live mandate must cover this particular pension plan (or the organization ledger).
    const planId = z.guid().safeParse(params.id);
    if (!planId.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Pension plan identifier is required');
    const noMandate = await financeViewMandateDenial(organizationId!, userId!, planId.data);
    if (noMandate) return noMandate;

    // 1. Rate limit
    const rl = await checkRateLimit(`ai-pension-trustee:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.PENSION_TRUSTEE_SUMMARY, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    // 3. AI safety
    enforceAISafety({ origin: 'pension-trustee-summary', action: 'POST', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'officer', dataClass: 'pension_financial' });

    // 4. Validate body: an empty body is acceptable (the valuation text is optional), a body that is present must be valid JSON of the right shape
    let bodyData: { valuationDocumentText?: string } = {};
    const rawBody = await request.text();
    if (rawBody.trim() !== '') {
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON');
      }
      const parsed = trusteeSummarySchema.safeParse(json);
      if (!parsed.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Invalid request body',
          parsed.error.flatten(),
        );
      }
      bodyData = parsed.data;
    }

    // 5. Execute
    try {
      const result = await summarizeTrusteeReport({
        planId: planId.data,
        organizationId: organizationId!,
        userId: userId!,
        valuationDocumentText: bodyData.valuationDocumentText,
      });
      return standardSuccessResponse(result);
    } catch (_error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Trustee summary generation failed.');
    }
  },
);
