/**
 * Federation Discovery API
 * 
 * POST /api/onboarding/discover-federation
 * 
 * Auto-detect potential parent federations based on:
 * - Province/jurisdiction
 * - Industry sector
 * - Organization size
 * - CLC affiliation
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/role-middleware';
import { autoDetectParentFederation } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
import { eventBus, AppEvents } from '@/lib/events';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const onboardingDiscoverFederationSchema = z.object({
  province: z.string().min(1, 'province is required'),
  sector: z.string().optional(),
  estimatedMemberCount: z.number().int().positive(),
});

export const POST = withRoleAuth('officer', async (request, context) => {
  const { userId, organizationId: _organizationId } = context;

  try {
    const rateLimit = await checkRateLimit(userId, RATE_LIMITS.ONBOARDING);
    if (!rateLimit.allowed) {
      logger.warn('Onboarding rate limit exceeded', { userId, endpoint: 'discover-federation' });
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
    const validation = onboardingDiscoverFederationSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { province, sector, estimatedMemberCount } = validation.data;

    if (!province) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'province is required'
    );
    }

    const suggestions = await autoDetectParentFederation(
      province,
      sector || null,
      estimatedMemberCount
    );

    logger.info('Federation discovery completed', { 
      userId,
      province,
      sector,
      suggestionCount: suggestions.length,
    });

    // Emit audit event
    eventBus.emit(AppEvents.AUDIT_LOG, {
      userId,
      action: 'federation_discovery',
      resource: 'onboarding',
      details: { province, sector, suggestionCount: suggestions.length },
    });

    return NextResponse.json({
      success: true,
      suggestions,
      metadata: {
        province,
        sector,
        totalSuggestions: suggestions.length,
      },
    });

  } catch (error) {
    logger.error('Federation discovery failed', { error });
    return NextResponse.json(
      { 
        error: 'Failed to discover federations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

