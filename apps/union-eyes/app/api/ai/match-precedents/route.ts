/**
 * AI Precedent Matching API Route
 * 
 * POST /api/ai/match-precedents
 * Match claims/grievances to relevant arbitration precedents
 */

import { NextResponse } from 'next/server';
import {
  matchClaimToPrecedents,
  analyzeClaimWithPrecedents,
  generateLegalMemorandum,
} from '@/lib/services/ai/precedent-matching-service';
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { checkEntitlement } from '@/lib/services/entitlements';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
import { guardAiFeature } from '@/lib/ai/ai-feature-guard';
import { AI_FEATURES } from '@/lib/services/feature-flags';
import { enforceAISafety } from '@nzila/policies';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

const matchPrecedentsSchema = z.object({
  action: z.enum(['match', 'analyze', 'memorandum']).default('match'),
  claim: z.object({
    facts: z.string().min(10, 'Facts must be at least 10 characters').max(20_000, 'Facts are too long'),
    issueType: z.string().min(1, 'Issue type is required').max(100),
    jurisdiction: z.string().max(100).optional(),
    memberId: z.guid().optional(),
  }),
  options: z.object({
    jurisdiction: z.string().max(100).optional(),
    issueType: z.string().max(100).optional(),
    limit: z.number().int().min(1).max(50).optional(),
    minRelevance: z.number().min(0).max(1).optional(),
    includeDistinctions: z.boolean().optional(),
    weightSemanticSimilarity: z.number().min(0).max(1).optional(),
    weightKeywordMatch: z.number().min(0).max(1).optional(),
    weightMetadata: z.number().min(0).max(1).optional(),
  }).prefault({}),
});

// The search and the candidate read run in the organization's own context inside the service; the provider calls run outside any transaction, so the route
// does not set `rlsOrgContext`. The entitlement is checked here, not by the wrapper, to keep its answer (with the upgrade address) as it was.
export const POST = withApi(
  {
    auth: { minRole: 'member' },
    body: matchPrecedentsSchema,
    registry: { audience: 'member', productionStatus: 'active', evidenceRequired: false, orgScoping: 'caller-org' },
    openapi: { tags: ['AI'], summary: 'Match a claim to arbitration precedents (advisory)' },
  },
  async ({ user, userId, organizationId, body }) => {
    // CRITICAL: Rate limit AI calls (expensive OpenAI API)
    const rateLimitResult = await checkRateLimit(
      `ai-completion:${userId}`,
      RATE_LIMITS.AI_COMPLETION
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded for AI operations. Please try again later.' },
        { 
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult)
        }
      );
    }

    // CRITICAL: Check subscription entitlement for AI match-precedents
    const entitlement = await checkEntitlement(organizationId!, 'ai_match_precedents');
    if (!entitlement.allowed) {
      return NextResponse.json(
        { 
          error: entitlement.reason,
          upgradeUrl: entitlement.upgradeUrl,
          feature: 'ai_match_precedents'
        },
        { status: 403 }
      );
    }

    // OWASP AI: Feature flag + AI safety gate
    const blocked = await guardAiFeature(AI_FEATURES.AI_MATCH_PRECEDENTS, { userId: userId!, organizationId: organizationId! });
    if (blocked) return blocked;
    enforceAISafety({ origin: 'match-precedents', action: 'POST', organizationId, userId, userRole: user?.role ?? 'member', dataClass: 'grievance_legal' });

    try {
      const { action, options } = body;
      // The organization is the caller's, never one named in the body.
      const claim = { ...body.claim, organizationId: organizationId! };

      return await performAuditedOperation({
        organizationId: organizationId!,
        userId: userId!,
        action: 'ai.precedent_matching.' + action,
        resourceType: 'ai_invocations',
      }, async () => {
      switch (action) {
        case 'match':
          // Simple precedent matching without full analysis
          const matches = await matchClaimToPrecedents(claim, options);
          return NextResponse.json({
            action: 'match',
            claim: {
              issueType: claim.issueType,
              jurisdiction: claim.jurisdiction,
            },
            matches,
            count: matches.length,
          });

        case 'analyze':
          // Full analysis with outcome prediction and strength assessment
          const analysis = await analyzeClaimWithPrecedents(claim, options);
          return NextResponse.json({
            action: 'analyze',
            claim: {
              issueType: claim.issueType,
              jurisdiction: claim.jurisdiction,
            },
            analysis: {
              predictedOutcome: analysis.predictedOutcome,
              strengthAnalysis: analysis.strengthAnalysis,
              suggestedArguments: analysis.suggestedArguments,
              topMatches: analysis.matches.slice(0, 5),
              totalMatchesFound: analysis.matches.length,
            },
          });

        case 'memorandum':
          // Generate full legal memorandum
          const fullAnalysis = await analyzeClaimWithPrecedents(claim, options);
          const memorandum = await generateLegalMemorandum(claim, fullAnalysis);

          return NextResponse.json({
            action: 'memorandum',
            claim: {
              issueType: claim.issueType,
              jurisdiction: claim.jurisdiction,
            },
            memorandum,
            analysis: {
              predictedOutcome: fullAnalysis.predictedOutcome,
              matchCount: fullAnalysis.matches.length,
            },
          });

        default:
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Invalid action. Use: match, analyze, or memorandum'
          );
      }
      });
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      return NextResponse.json(
        {
          error: 'Precedent matching failed',
        },
        { status: 500 }
      );
    }
  },
);

/**
 * Example request bodies:
 * 
 * MATCH:
 * {
 *   "action": "match",
 *   "claim": {
 *     "facts": "Employee with 15 years seniority was terminated for alleged misconduct. No prior warnings or progressive discipline applied.",
 *     "issueType": "wrongful_dismissal",
 *     "jurisdiction": "british_columbia"
 *   },
 *   "options": {
 *     "limit": 10,
 *     "minRelevance": 0.7
 *   }
 * }
 * 
 * ANALYZE:
 * {
 *   "action": "analyze",
 *   "claim": {
 *     "facts": "Employee with 15 years seniority was terminated for alleged misconduct. No prior warnings or progressive discipline applied.",
 *     "issueType": "wrongful_dismissal",
 *     "jurisdiction": "british_columbia"
 *   }
 * }
 * 
 * MEMORANDUM:
 * {
 *   "action": "memorandum",
 *   "claim": {
 *     "facts": "...detailed facts...",
 *     "issueType": "wrongful_dismissal",
 *     "jurisdiction": "british_columbia"
 *   }
 * }
 */
