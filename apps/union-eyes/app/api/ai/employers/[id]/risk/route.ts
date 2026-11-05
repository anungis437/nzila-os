/**
 * GET /api/ai/employers/[id]/risk
 * AI-powered employer risk assessment.
 *
 * Aggregates grievance frequency, compliance alerts, dispatch non-compliance,
 * and arbitration history to produce a risk score + band for the employer.
 *
 * RBAC:         steward (frontline role that acts on risk signals)
 * Feature flag: AI_FEATURES.EMPLOYER_RISK
 * Entitlement:  ai_advanced_insights
 * Rate limit:   AI_COMPLETION (20/hr per user)
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { calculateEmployerRisk } from '@/lib/ai/employer-risk';
import { standardErrorResponse, standardSuccessResponse, ErrorCode } from '@/lib/api/standardized-responses';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { enforceAISafety } from '@nzila/policies';

// The helper reads the employer and its signals in the organization's own context and ends that transaction before the provider is called, so the route
// does not set `rlsOrgContext`. The entitlement is checked by the wrapper.
export const GET = withApi(
  {
    auth: { minRole: 'steward' },
    entitlement: 'ai_advanced_insights',
    registry: { audience: 'steward', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'AI risk assessment of one employer (advisory)' },
  },
  async ({ user, userId, organizationId, params }) => {
    // 1. Rate limit
    const rl = await checkRateLimit(`ai-employer-risk:${userId}`, RATE_LIMITS.AI_COMPLETION);
    if (!rl.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'AI rate limit exceeded. Try again later.');
    }

    // 2. Feature gate
    const blocked = await guardAiFeature(AI_FEATURES.EMPLOYER_RISK, {
      userId: userId!,
      organizationId: organizationId!,
    });
    if (blocked) return blocked;

    // 3. AI Safety
    enforceAISafety({ origin: 'employer-risk', action: 'GET', organizationId: organizationId!, userId: userId!, userRole: user?.role ?? 'steward', dataClass: 'confidential' });

    // 4. Execute
    const employerId = z.guid().safeParse(params.id);
    if (!employerId.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid employer ID');
    }
    try {
      const result = await calculateEmployerRisk({
        employerId: employerId.data,
        organizationId: organizationId!,
        userId: userId!,
      });
      return standardSuccessResponse(result);
    } catch (_error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Employer risk assessment failed.');
    }
  },
);
