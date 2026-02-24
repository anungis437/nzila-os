/**
 * Feature Flags API Route
 * 
 * Returns enabled features for the current user.
 * 
 * Security: Protected with withApiAuth guard (migrated Feb 2026)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { evaluateFeatures, LRO_FEATURES } from '@/lib/services/feature-flags';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const GET = withApiAuth(async (request: NextRequest, context: BaseAuthContext) => {
  try {
    // User context provided by withApiAuth guard
    const userId = context.userId;
    const orgId = context.organizationId;
    
    // Evaluate all LRO features for this user
    const featureNames = Object.values(LRO_FEATURES);
    
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

