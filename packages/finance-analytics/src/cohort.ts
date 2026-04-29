import type { FundContribution } from '@nzila/finance-governance'
import type { CohortMetric } from './types.js'

export function computeCohortMetric(
  orgId: string,
  cohortId: string,
  periodLabel: string,
  contributions: FundContribution[],
  dueAmountCents: number,
): CohortMetric {
  const memberIds = new Set(contributions.map((c) => c.contributorId))
  const paidCents = contributions.reduce((sum, c) => sum + c.amountCents, 0)
  const collectionRate = dueAmountCents > 0 ? paidCents / dueAmountCents : 0
  return {
    cohortId,
    orgId,
    periodLabel,
    memberCount: memberIds.size,
    totalDuesCents: dueAmountCents,
    paidCents,
    collectionRate,
  }
}
