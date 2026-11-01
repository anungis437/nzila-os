/**
 * Clause Suggestions API
 * 
 * POST /api/onboarding/suggest-clauses
 * 
 * Suggest relevant clauses based on:
 * - Parent organization hierarchy
 * - Sector and province (filters: the suggestions are for the organization's own sector and province)
 * - How the clause reached the organization (public, or shared with it)
 *
 * Only clauses the organization may already read are suggested (lib/utils/smart-onboarding.ts); a clause whose source is anonymized or
 * unclassified is offered without naming its owner.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withRoleAuth, type MemberRole } from '@/lib/role-middleware';
import { suggestRelevantClauses } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
import { recordOnboardingRead } from '@/lib/utils/onboarding-read-audit';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const onboardingSuggestClausesSchema = z.object({
  organizationId: z.guid('Invalid organizationId'),
});

export const POST = withRoleAuth('officer' as MemberRole, async (request, context) => {
  const { userId, organizationId } = context;

  try {
    const rateLimit = await checkRateLimit(userId, RATE_LIMITS.ONBOARDING);
    if (!rateLimit.allowed) {
      logger.warn('Onboarding rate limit exceeded', { userId, endpoint: 'suggest-clauses' });
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      );
    }

    const body = await request.json();
    // Validate request body
    const validation = onboardingSuggestClausesSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }
    
    // Suggestions are drawn for the caller's own organization; another organization named in the body reads as not found.
    if (!organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    }
    if (validation.data.organizationId !== organizationId) {
      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Organization not found');
    }
    const reqOrgId = organizationId;

    const suggestions = await suggestRelevantClauses(reqOrgId);

    logger.info('Clause suggestions generated', { 
      userId,
      organizationId: reqOrgId,
      suggestionCount: suggestions.length,
    });

    await recordOnboardingRead({ organizationId: reqOrgId, userId }, 'onboarding.clause_suggestions', { suggestionCount: suggestions.length });

    return NextResponse.json({
      success: true,
      suggestions,
      metadata: {
        totalSuggestions: suggestions.length,
        topRelevanceScore: suggestions[0]?.relevanceScore || 0,
      },
    });

  } catch (error) {
    logger.error('Clause suggestions failed', { error });
    return NextResponse.json(
      { 
        error: 'Failed to suggest clauses',
      },
      { status: 500 }
    );
  }
});

