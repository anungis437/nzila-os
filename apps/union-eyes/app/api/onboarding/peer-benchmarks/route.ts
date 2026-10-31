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
import { withRoleAuth, type MemberRole } from '@/lib/role-middleware';
import { getPeerBenchmarks } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
import { recordOnboardingRead } from '@/lib/utils/onboarding-read-audit';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member' as MemberRole, async (request, context) => {
  const { userId, organizationId } = context;

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
    // The comparison is of the caller's own organization against its peers. A target taken from the request would let any member
    // read another organization's standing (member count and rates), so a named target must be the caller's own and otherwise reads
    // as not found.
    if (!organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    }
    const requested = searchParams.get('organizationId');
    if (requested && requested !== organizationId) {
      return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Organization not found');
    }
    const reqOrgId = organizationId;

    const benchmarks = await getPeerBenchmarks(reqOrgId);

    logger.info('Peer benchmarks generated', { 
      userId,
      organizationId: reqOrgId,
      benchmarkCount: benchmarks.length,
    });

    await recordOnboardingRead({ organizationId: reqOrgId, userId }, 'onboarding.peer_benchmarks', { benchmarkCount: benchmarks.length });

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
      },
      { status: 500 }
    );
  }
});

