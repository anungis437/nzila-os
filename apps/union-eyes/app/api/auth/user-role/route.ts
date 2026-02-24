import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, auth } from "@/lib/api-auth-guard";
import { getUserRole } from "@/lib/auth/rbac-server";

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

/**
 * GET /api/auth/user-role
 * Fetch the current user's role from the database
 */
export const GET = withApiAuth(async (request: NextRequest, _context) => {
  try {
    const { userId: authedUserId } = await auth();

    // Use userId from URL params if provided (for admin use), otherwise use authenticated user
    const searchParams = request.nextUrl.searchParams;
    const queryUserId = searchParams.get('userId');
    const targetUserId = queryUserId || authedUserId;

    if (!targetUserId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Not authenticated');
    }

    // Fetch role from database/Clerk
    const role = await getUserRole(targetUserId);

    return NextResponse.json({ role });
  } catch (error) {
    console.error('[/api/auth/user-role] Error:', error);
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch user role',
      error
    );
  }
});
