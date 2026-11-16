import { NextResponse } from 'next/server'
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'
import { logger } from '@/lib/logger'
import { PrivacyRequestError } from './requests'
import type { PrivacyIdentity } from './request-contract'

function privacyFailure(status: number, reason: string) {
  return NextResponse.json({ success: false, error: {
    code: 'PRIVACY_REQUEST_REFUSED', message: 'The privacy operation could not be completed', details: { reason },
  } }, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function withPrivacyDatabase<T>(
  context: { userId: string | null; organizationId: string | null; request?: Request },
  operation: (tx: RLSTx, actor: PrivacyIdentity) => Promise<T>,
): Promise<T | NextResponse> {
  if (!context.userId || !context.organizationId) return standardErrorResponse(ErrorCode.FORBIDDEN, 'An active organization is required')
  const actor = { userId: context.userId, organizationId: context.organizationId }
  const expectedOrganization = context.request?.headers.get('x-ue-expected-organization')
  if (expectedOrganization && expectedOrganization !== actor.organizationId)
    return privacyFailure(409, 'stale')
  try {
    return await withRLSContext({ organizationId: actor.organizationId }, tx => operation(tx, actor))
  } catch (error) {
    if (error instanceof AuthOrgBindingError) throw error
    if (error instanceof PrivacyRequestError) {
      const status = error.kind === 'not_found' ? 404 : error.kind === 'forbidden' ? 403 :
        error.kind === 'too_many_requests' ? 429 : error.kind === 'export_expired' ? 410 : 409
      return privacyFailure(status, error.kind)
    }
    // Driver errors can contain SQL parameters, including request or response text.
    // Keep those out of the common API error logger and client response.
    logger.error('Privacy request operation and audit could not be committed')
    return standardErrorResponse(ErrorCode.SERVICE_UNAVAILABLE, 'The privacy request operation and audit could not be saved')
  }
}
