import { NextRequest, NextResponse } from 'next/server'
import { cronSecretMatches } from '@/lib/api/cron-secret'
import { RewardsInstitutionalAuthorityUnavailable } from '@/lib/rewards/credit-authority'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'

const TASKS = ['anniversaries', 'expirations', 'scheduled', 'all'] as const

/** The former daily 09:00 UTC reward job is off the active schedule while
 * UE-INST-REWARDS-PROGRAM-AUTOMATION-EXPIRY-AND-EXPORT remains deferred.
 * A genuine cron credential authenticates a caller; it cannot mint authority. */
export async function POST(request: NextRequest) {
  if (!(await cronSecretMatches(request.headers)))
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized')
  const task = request.nextUrl.searchParams.get('task') || 'all'
  if (!TASKS.includes(task as (typeof TASKS)[number]))
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_TASK', allowed: TASKS },
      { status: 400 },
    )
  const unavailable = new RewardsInstitutionalAuthorityUnavailable()
  return standardErrorResponse(ErrorCode.NOT_IMPLEMENTED, unavailable.message)
}
