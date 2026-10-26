/**
 * Live-mandate gate for financial operations that are not a `public.payments` duty.
 *
 * Remittances and payroll-scoped reads stay on the financial role allow-list. That allow-list is not a mandate.
 * When the organization has no live financial mandate, the operation answers FINANCIAL_MANDATES_NOT_ISSUED and
 * writes nothing. A platform administrator title does not satisfy this check.
 */
import { ApiError, ErrorCode } from '@/lib/api/errors'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { FinancialDutyError, assertLiveFinancialMandate } from '@/lib/authority/store/finance-route-adapter'
import { drizzleExecutor } from '@/lib/authority/store/route-adapter'

export async function requireLiveFinancialMandate(tx: RLSTx, organizationId: string): Promise<void> {
  try {
    await assertLiveFinancialMandate(drizzleExecutor(tx), organizationId)
  } catch (error) {
    if (error instanceof FinancialDutyError && error.code === 'FINANCIAL_MANDATES_NOT_ISSUED') {
      throw new ApiError(ErrorCode.FORBIDDEN, error.message, { code: error.code })
    }
    throw error
  }
}
