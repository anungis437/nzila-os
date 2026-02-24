/**
 * GET /api/deadlines/dashboard
 * Dashboard summary with counts and metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSummary } from '@/lib/deadline-service';
import { withApiAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withApiAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId') ?? searchParams.get('orgId') ?? searchParams.get('organization_id') ?? searchParams.get('org_id');
  
  if (!organizationId) {
    return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Organization ID required'
    );
  }
  
  try {
    const summary = await getDashboardSummary(organizationId);
    return NextResponse.json(summary);
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch summary',
      error
    );
  }
});

