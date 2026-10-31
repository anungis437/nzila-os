import type { NextResponse } from 'next/server'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate'
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses'

/**
 * Financial and pension intelligence reads dues, arrears, remittances, ledger and pension data of the organization. An
 * officer role title is not authority over those records: the caller needs a live financial view mandate.
 */
export async function assertFinanceViewMandate(organizationId: string, userId: string): Promise<void> {
  await withRLSContext({ organizationId, userId }, (tx) =>
    requireLiveFinancialMandate(tx, { organizationId, userId, action: 'finance:view' }),
  )
}

/** The same check for a handler that answers with a Response instead of throwing: null when the caller holds the mandate. */
export async function financeViewMandateDenial(organizationId: string, userId: string): Promise<NextResponse | null> {
  try {
    await assertFinanceViewMandate(organizationId, userId)
    return null
  } catch {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'A live financial view mandate is required')
  }
}
