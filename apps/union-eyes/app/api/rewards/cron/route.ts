import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { cronSecretMatches } from '@/lib/api/cron-secret'
import { RewardsInstitutionalAuthorityUnavailable } from '@/lib/rewards/credit-authority'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'
import { capabilityNotImplementedResponse } from '@/lib/finance/financial-authority'

const TASKS = ['anniversaries', 'expirations', 'scheduled', 'all'] as const
const taskSchema = z.enum(TASKS)

/** The former daily 09:00 UTC reward job is off the active schedule while
 * UE-INST-REWARDS-PROGRAM-AUTOMATION-EXPIRY-AND-EXPORT remains deferred.
 * A genuine cron credential authenticates a caller; it cannot mint authority.
 *
 * Security: the cron secret (CRON_SECRET_KEY or CRON_SECRET), presented as x-cron-secret or a bearer token, is checked
 * (lib/api/cron-secret.ts, constant time, unset never matches) before the task parameter is read. The only input, the
 * `task` query parameter, is validated against the closed task list; an unknown task is refused with 400. */
export async function POST(request: NextRequest) {
  if (!(await cronSecretMatches(request.headers)))
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized')
  const task = taskSchema.safeParse(request.nextUrl.searchParams.get('task') || 'all')
  if (!task.success)
    return NextResponse.json(
      { success: false, error: 'UNKNOWN_TASK', allowed: TASKS },
      { status: 400 },
    )
  const unavailable = new RewardsInstitutionalAuthorityUnavailable()
  return capabilityNotImplementedResponse('rewards.automation', unavailable.message)
}
