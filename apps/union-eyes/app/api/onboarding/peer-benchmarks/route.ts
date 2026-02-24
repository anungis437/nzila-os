/**
 * Peer Benchmarking API
 * 
 * GET /api/onboarding/peer-benchmarks?organizationId=xxx
 * 
 * Compare organization metrics to peers:
 * - Member count
 * - Per-capita rates
 * - Industry benchmarks
 * - National averages
 */

import { NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/role-middleware';
import { getPeerBenchmarks } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
import { eventBus, AppEvents } from '@/lib/events';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request, context) => {
  const { userId, organizationId: _organizationId } = context;

  try {
    const rateLimit = await checkRateLimit(userId, RATE_LIMITS.ONBOARDING);
    if (!rateLimit.allowed) {
      logger.warn('Onboarding rate limit exceeded', { userId, endpoint: 'peer-benchmarks' });
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimit.resetIn },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimit),
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const reqOrgId = searchParams.get('organizationId');

    if (!reqOrgId) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'organizationId is required'
    );
    }

    const benchmarks = await getPeerBenchmarks(reqOrgId);

    logger.info('Peer benchmarks generated', { 
      userId,
      organizationId: reqOrgId,
      benchmarkCount: benchmarks.length,
    });

    // Emit audit event
    eventBus.emit(AppEvents.AUDIT_LOG, {
      userId,
      action: 'peer_benchmarks',
      resource: 'onboarding',
      details: { organizationId: reqOrgId, benchmarkCount: benchmarks.length },
    });

    return NextResponse.json({
      success: true,
      benchmarks,
      metadata: {
        totalBenchmarks: benchmarks.length,
        categories: [...new Set(benchmarks.map(b => b.category))],
      },
    });

  } catch (error) {
    logger.error('Peer benchmarking failed', { error });
    return NextResponse.json(
      { 
        error: 'Failed to get peer benchmarks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

