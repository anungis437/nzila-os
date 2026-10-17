import { NextRequest, NextResponse } from "next/server";

import { getOverdueClaims, getClaimsApproachingDeadline } from "@/lib/workflow-engine";
import { requireApiAuth } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';
import { clientErrorResponse } from '@/lib/api/authorization-denial';

 
 
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
/**
 * GET /api/workflow/overdue
 * Get all overdue claims (requires admin/steward access)
 * 
 * GUARDED: requireApiAuth with organization isolation
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication guard with organization isolation
    const { userId: _userId, organizationId: _organizationId } = await requireApiAuth({
      orgScoped: true,
      roles: ['admin', 'steward'],
    });

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "overdue";

    let result;
    if (type === "approaching") {
      result = await getClaimsApproachingDeadline();
    } else {
      result = await getOverdueClaims();
    }

    return NextResponse.json({
      success: true,
      count: result.length,
      claims: result,
    });
  } catch (error) {
    const denied = clientErrorResponse(error);
    if (denied) return denied;
    logger.error('Error getting overdue claims', error as Error);
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to get overdue claims',
      error
    );
  }
}

