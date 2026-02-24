/**
 * Clause Suggestions API
 * 
 * POST /api/onboarding/suggest-clauses
 * 
 * Suggest relevant clauses based on:
 * - Parent organization hierarchy
 * - Sector/province similarity
 * - Sharing level availability
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/role-middleware';
import { suggestRelevantClauses } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
import { eventBus, AppEvents } from '@/lib/events';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const onboardingSuggestClausesSchema = z.object({
  organizationId: z.string().uuid('Invalid organizationId'),
});

export const POST = withRoleAuth('officer', async (request, context) => {
  const { userId, organizationId: _organizationId } = context;

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
        validation.error.errors
      );
    }
    
    const { organizationId: reqOrgId } = validation.data;

    const suggestions = await suggestRelevantClauses(reqOrgId);

    logger.info('Clause suggestions generated', { 
      userId,
      organizationId: reqOrgId,
      suggestionCount: suggestions.length,
    });

    // Emit audit event
    eventBus.emit(AppEvents.AUDIT_LOG, {
      userId,
      action: 'clause_suggestions',
      resource: 'onboarding',
      details: { organizationId: reqOrgId, suggestionCount: suggestions.length },
    });

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
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

