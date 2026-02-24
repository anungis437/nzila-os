/**
 * Microsoft Outlook Calendar OAuth Authorization
 * 
 * Initiates the OAuth flow by redirecting to Microsoft's authorization page.
 * 
 * @module api/calendar-sync/microsoft/auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/external-calendar-sync/microsoft-calendar-service';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  const { userId } = context;

  try {
    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }

    // Generate authorization URL with userId as state
    const authUrl = await getAuthorizationUrl(userId);

    // Redirect to Microsoft authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to initiate Microsoft Calendar authorization',
      error
    );
  }
});

