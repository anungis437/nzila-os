/**
 * Principal gate for financial operations that are not a `public.payments` duty.
 *
 * The organization must have a live financial mandate, and this caller must hold the
 * requested power on a mandate that covers the record. A role allow-list does not.
 */
import { ApiError, ErrorCode } from '@/lib/api/errors'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { FinancialDutyError } from '@/lib/authority/store/finance-route-adapter'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'
import { assertPrincipalFinancialAuthority, type PrincipalFinancialGrant, type PrincipalFinancialInput } from '@/lib/finance/principal-financial-authority'

export type { PrincipalFinancialGrant, PrincipalFinancialInput }

export async function requireLiveFinancialMandate(tx: RLSTx, input: PrincipalFinancialInput): Promise<PrincipalFinancialGrant> {
  try {
    return await assertPrincipalFinancialAuthority(drizzleExecutor(tx), input)
  } catch (error) {
    if (error instanceof FinancialDutyError && error.code === 'NOT_FOUND') {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Record not found', { code: error.code })
    }
    if (error instanceof FinancialDutyError && error.code === 'INVALID_REQUEST') {
      throw new ApiError(ErrorCode.VALIDATION_ERROR, error.message, { code: error.code })
    }
    if (
      error instanceof FinancialDutyError &&
      (error.code === 'FINANCIAL_MANDATES_NOT_ISSUED' || error.code === 'DUTY_NOT_HELD' || error.code === 'SEGREGATION_OF_DUTIES')
    ) {
      throw new ApiError(ErrorCode.FORBIDDEN, error.message, { code: error.code })
    }
    throw error
  }
}
