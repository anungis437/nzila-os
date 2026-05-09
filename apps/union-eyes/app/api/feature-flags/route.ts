/**
 * Feature Flags API Route
 * 
 * Returns enabled features for the current user.
 * 
 * Security: Protected with withApiAuth guard (migrated Feb 2026)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { evaluateFeatures, LRO_FEATURES, AI_FEATURES } from '@/lib/services/feature-flags';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const GET = withApiAuth(async (request: NextRequest, context: BaseAuthContext) => {
  try {
    // User context provided by withApiAuth guard
    const userId = context.userId;
    const orgId = context.organizationId;

    // Single-flag compatibility mode: /api/feature-flags?flag=pilot-mode
    // used by pilot context and E2E assertions.
    const requestedFlag = request.nextUrl.searchParams.get('flag')?.trim();
    if (requestedFlag) {
      const isPilotRuntime = ['pilot', 'demo'].includes((process.env.NZILA_MODE ?? '').toLowerCase());
      const isQaTestEnv = (process.env.QA_TEST_ENV ?? '').toLowerCase() === 'true' || process.env.NODE_ENV === 'test';

      let enabled = false;
      if (requestedFlag === 'pilot-mode') {
        // Pilot mode is fail-closed by default in production runtime.
        // In explicit test environments, keep it deterministic for E2E validation.
        enabled = isPilotRuntime || isQaTestEnv;
      } else {
        const single = await evaluateFeatures([requestedFlag], {
          userId,
          organizationId: orgId || undefined,
        });
        enabled = Boolean(single[requestedFlag]);
      }

      return NextResponse.json({
        flag: requestedFlag,
        enabled,
        userId,
        organizationId: orgId || null,
      });
    }
    
    // Evaluate all feature flags (LRO + AI) for this user
    const featureNames = [...Object.values(LRO_FEATURES), ...Object.values(AI_FEATURES)];
    
    const flags = await evaluateFeatures(featureNames, {
      userId,
      organizationId: orgId || undefined,
    });
    
    return NextResponse.json({
      flags,
      userId,
      organizationId: orgId || null,
    });
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to evaluate feature flags');
  }
});

