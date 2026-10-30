import { issueCalendarOAuthState, setCalendarOAuthStateCookie } from '@/lib/external-calendar-sync/oauth-state';
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
  const userId = typeof context.userId === 'string' ? context.userId : null;

  try {
    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }

    const organizationId = typeof context.organizationId === 'string' ? context.organizationId : null;
    if (!organizationId) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    const state = issueCalendarOAuthState('microsoft', userId, organizationId);
    const authUrl = await getAuthorizationUrl(state);
    const response = NextResponse.redirect(authUrl);
    setCalendarOAuthStateCookie(response, 'microsoft', state);
    return response;
  } catch (error) {
    // Missing OAuth client configuration is an unavailable integration, not an internal fault.
    if (error instanceof Error && /^Missing required Microsoft calendar OAuth environment variables/.test(error.message)) {
      return NextResponse.json({ error: 'Microsoft calendar integration is not configured' }, { status: 503 });
    }
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to initiate Microsoft Calendar authorization',
      error
    );
  }
});

