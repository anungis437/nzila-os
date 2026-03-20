/**
 * Zonga — Rights & Royalty Invariant Guards (R1–R5)
 *
 * Runtime enforcement of rights invariants at the application boundary.
 *
 * R1: Splits always sum to 100% (±0.01)
 * R2: No payouts on disputed releases
 * R3: All splits require valid creator references
 * R4: Dispute resolution must unfreeze affected payouts
 * R5: Sync licenses require valid rights holder
 */

import { logger } from '@/lib/logger'

export interface RightsGuardResult {
  passed: boolean
  invariant: string
  details?: string
}

/** R1: Splits must sum to exactly 100% (±0.01 tolerance) */
export function guardSplitsSum100(
  splits: readonly { sharePercent: number }[],
): RightsGuardResult {
  const total = splits.reduce((sum, s) => sum + s.sharePercent, 0)
  if (Math.abs(total - 100) > 0.01) {
    logger.error('R1 VIOLATION: Splits do not sum to 100%', { total, splitCount: splits.length })
    return {
      passed: false,
      invariant: 'R1_SPLITS_SUM_100',
      details: `Splits sum to ${total}%, expected 100%`,
    }
  }
  return { passed: true, invariant: 'R1_SPLITS_SUM_100' }
}

/** R2: Cannot execute payout for creators with active disputes on a release */
export function guardNoPayoutOnDisputedRelease(
  hasActiveDispute: boolean,
  releaseId: string,
): RightsGuardResult {
  if (hasActiveDispute) {
    logger.warn('R2 BLOCK: Payout blocked due to active dispute', { releaseId })
    return {
      passed: false,
      invariant: 'R2_NO_PAYOUT_ON_DISPUTED',
      details: `Release ${releaseId} has active disputes — payouts frozen`,
    }
  }
  return { passed: true, invariant: 'R2_NO_PAYOUT_ON_DISPUTED' }
}

/** R3: All splits must reference valid, registered creators */
export function guardSplitsHaveValidCreators(
  splits: readonly { creatorId: string; creatorName: string }[],
): RightsGuardResult {
  for (const s of splits) {
    if (!s.creatorId || s.creatorId.trim() === '') {
      logger.error('R3 VIOLATION: Split has empty creatorId', { creatorName: s.creatorName })
      return {
        passed: false,
        invariant: 'R3_VALID_CREATOR_REFS',
        details: `Split for "${s.creatorName}" has no valid creator reference`,
      }
    }
  }
  return { passed: true, invariant: 'R3_VALID_CREATOR_REFS' }
}

/** R4: Resolving a dispute must unfreeze payouts if no other active disputes remain */
export function guardDisputeResolutionUnfreezes(
  remainingActiveDisputes: number,
  willUnfreeze: boolean,
): RightsGuardResult {
  if (remainingActiveDisputes === 0 && !willUnfreeze) {
    logger.error('R4 VIOLATION: Dispute resolved but payouts not unfrozen')
    return {
      passed: false,
      invariant: 'R4_DISPUTE_UNFREEZE',
      details: 'All disputes resolved but payout freeze persists',
    }
  }
  return { passed: true, invariant: 'R4_DISPUTE_UNFREEZE' }
}

/** R5: Sync license must reference a valid asset with established rights */
export function guardSyncLicenseHasRightsHolder(
  assetId: string,
  hasRightsHolder: boolean,
): RightsGuardResult {
  if (!hasRightsHolder) {
    logger.warn('R5 WARNING: Sync license for asset without established rights', { assetId })
    return {
      passed: false,
      invariant: 'R5_SYNC_LICENSE_RIGHTS',
      details: `Asset ${assetId} has no established rights holder for sync licensing`,
    }
  }
  return { passed: true, invariant: 'R5_SYNC_LICENSE_RIGHTS' }
}
