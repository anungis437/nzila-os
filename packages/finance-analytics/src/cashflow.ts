import type { LedgerEntry } from '@nzila/finance-ledger'
import type { CashflowSummary } from './types.js'

export function summarizeCashflow(
  orgId: string,
  entries: LedgerEntry[],
  periodStart: string,
  periodEnd: string,
  currency: string,
): CashflowSummary {
  const inRange = entries.filter(
    (e) => e.createdAt >= periodStart && e.createdAt <= periodEnd && e.orgId === orgId,
  )
  const totalInflowCents = inRange
    .filter((e) => e.entryType === 'credit')
    .reduce((sum, e) => sum + e.amountCents, 0)
  const totalOutflowCents = inRange
    .filter((e) => e.entryType === 'debit')
    .reduce((sum, e) => sum + e.amountCents, 0)
  return {
    orgId,
    periodStart,
    periodEnd,
    totalInflowCents,
    totalOutflowCents,
    netCents: totalInflowCents - totalOutflowCents,
    currency,
  }
}
