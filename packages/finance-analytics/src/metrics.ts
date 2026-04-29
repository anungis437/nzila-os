import type { Transaction } from '@nzila/finance-core'
import type { CommunityFund, HardshipDisbursement } from '@nzila/finance-governance'
import type { FeeRevenueSummary, UtilizationMetric } from './types.js'

export function computeFeeRevenue(
  orgId: string,
  transactions: Transaction[],
  periodStart: string,
  periodEnd: string,
  currency: string,
): FeeRevenueSummary {
  const feeTransactions = transactions.filter(
    (t) =>
      t.orgId === orgId &&
      t.type === 'fee' &&
      t.createdAt >= periodStart &&
      t.createdAt <= periodEnd,
  )

  const byFeeType: Record<string, number> = {}
  let totalFeeCents = 0

  for (const tx of feeTransactions) {
    const feeType = (tx.metadata?.feeType as string | undefined) ?? 'unknown'
    byFeeType[feeType] = (byFeeType[feeType] ?? 0) + tx.amountCents
    totalFeeCents += tx.amountCents
  }

  return {
    orgId,
    periodStart,
    periodEnd,
    totalFeeCents,
    currency,
    byFeeType,
  }
}

export function computeUtilization(
  orgId: string,
  fund: CommunityFund,
  disbursements: HardshipDisbursement[],
): UtilizationMetric {
  const approvedDisbursements = disbursements.filter(
    (d) => d.orgId === orgId && d.fundId === fund.id && d.status === 'approved',
  )
  const usedCents = approvedDisbursements.reduce((sum, d) => sum + d.amountCents, 0)
  const utilizationRate = fund.balanceCents > 0 ? usedCents / fund.balanceCents : 0
  return {
    orgId,
    fundId: fund.id,
    allocatedCents: fund.balanceCents,
    usedCents,
    utilizationRate,
  }
}
