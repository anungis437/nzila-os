import { NextResponse } from 'next/server'

/**
 * Emergency declaration, break-glass activation, recovery and preparedness reporting have no persisted state, no
 * authority decision and no audited lifecycle behind them (capability UE-EMERGENCY-DECLARATION). The routes used to
 * answer 200 with a declaration, an "activated" break-glass state, "audit logging: true", notifications "sent" and
 * invented preparedness and compliance figures; none of it happened or was measured. They now say so.
 */
export const EMERGENCY_NOT_IMPLEMENTED_MESSAGE =
  'Emergency declaration is not implemented. No declaration was recorded, no emergency or break-glass access was granted, ' +
  'no notification was sent and no location data was collected or purged.'

export function emergencyNotImplemented(): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_IMPLEMENTED', message: EMERGENCY_NOT_IMPLEMENTED_MESSAGE } },
    { status: 501 },
  )
}
