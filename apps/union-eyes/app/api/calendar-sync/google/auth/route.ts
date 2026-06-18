/**
 * Google Calendar OAuth Authorization
 *
 * Initiates the OAuth flow by redirecting to Google's authorization page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/external-calendar-sync/google-calendar-service'
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'

export const dynamic = 'force-dynamic'

export const GET = withRoleAuth('member', async (_request: NextRequest, context: BaseAuthContext) => {
  try {
    const userId = typeof context.userId === 'string' ? context.userId : null

    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required')
    }

    const authUrl = getAuthorizationUrl(userId)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to initiate Google Calendar authorization',
      error,
    )
  }
})
