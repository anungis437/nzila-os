import { randomUUID } from 'node:crypto'
import type { HumanReviewFlag } from './types'
import { getGovernanceStore, persistGovernanceCollection } from './store'

export function flagForReview(params: {
  decisionId: string
  reason: string
  flaggedBy: string
  priority: 'low' | 'medium' | 'high' | 'critical'
}): HumanReviewFlag {
  const reviewFlags = getGovernanceStore().getReviewFlags()
  const flag: HumanReviewFlag = {
    id: randomUUID(),
    ...params,
    flaggedAt: new Date().toISOString(),
    resolved: false,
  }
  reviewFlags.push(flag)
  persistGovernanceCollection('reviewFlags')
  return flag
}

export function resolveReviewFlag(
  flagId: string,
  resolution: string,
): HumanReviewFlag | undefined {
  const reviewFlags = getGovernanceStore().getReviewFlags()
  const flag = reviewFlags.find((f) => f.id === flagId)
  if (flag) {
    flag.resolved = true
    flag.resolution = resolution
    persistGovernanceCollection('reviewFlags')
  }
  return flag
}

export function getPendingReviewFlags(): HumanReviewFlag[] {
  const reviewFlags = getGovernanceStore().getReviewFlags()
  return reviewFlags.filter((f) => !f.resolved)
}

export function clearReviewFlags(): void {
  const reviewFlags = getGovernanceStore().getReviewFlags()
  reviewFlags.length = 0
  persistGovernanceCollection('reviewFlags')
}
