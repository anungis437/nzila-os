/**
 * Smart Defaults API
 * 
 * GET /api/onboarding/smart-defaults?organizationType=xxx&memberCount=xxx
 * 
 * Get intelligent default configuration:
 * - Rate limits based on size
 * - Recommended features
 * - Suggested integrations
 */

import { NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/role-middleware';
import { getSmartDefaults } from '@/lib/utils/smart-onboarding';
import { logger } from '@/lib/logger';
 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const GET = withRoleAuth('member', async (request, context) => {
  const { userId, organizationId: _organizationId } = context;

  try {
    const { searchParams } = new URL(request.url);
    const organizationType = searchParams.get('organizationType') || 'local';
    const memberCountStr = searchParams.get('memberCount');
    const memberCount = memberCountStr ? parseInt(memberCountStr, 10) : undefined;

    const defaults = getSmartDefaults(organizationType, memberCount);

    logger.info('Smart defaults generated', { 
      userId,
      organizationType,
      memberCount,
    });

    return NextResponse.json({
      success: true,
      defaults,
      metadata: {
        organizationType,
        memberCount: memberCount || 'not specified',
      },
    });

  } catch (error) {
    logger.error('Smart defaults generation failed', { error });
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error');
  }
});

