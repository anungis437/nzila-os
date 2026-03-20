/**
 * @nzila/zonga-rights — Dispute Engine
 *
 * Filing, reviewing, and resolving rights disputes.
 * Disputes freeze payouts until resolved.
 */
import type { RightsDispute, SplitAgreement, SplitEntry } from './types'
import { DisputeStatus, AgreementStatus } from './types'

// ── Types ─────────────────────────────────────────────────────────────────

export interface DisputeAction {
  readonly allowed: boolean
  readonly error: string | null
}

export interface DisputeResolutionResult {
  readonly dispute: RightsDispute
  readonly agreementUpdated: boolean
  readonly payoutsUnfrozen: boolean
}

// ── Filing ────────────────────────────────────────────────────────────────

/**
 * Check if a dispute can be filed against a given agreement.
 */
export function canFileDispute(
  agreement: SplitAgreement,
  existingDisputes: readonly RightsDispute[],
): DisputeAction {
  // Cannot dispute a draft agreement
  if (agreement.status === AgreementStatus.DRAFT) {
    return { allowed: false, error: 'Cannot dispute a draft agreement' }
  }

  // Cannot dispute an already-disputed agreement with open dispute
  const openDispute = existingDisputes.find(
    (d) =>
      d.assetId === agreement.assetId &&
      d.status !== DisputeStatus.RESOLVED &&
      d.status !== DisputeStatus.DISMISSED,
  )
  if (openDispute) {
    return { allowed: false, error: 'An open dispute already exists for this asset' }
  }

  return { allowed: true, error: null }
}

// ── Status Transitions ───────────────────────────────────────────────────

const DISPUTE_TRANSITIONS: Record<string, readonly string[]> = {
  [DisputeStatus.FILED]: [DisputeStatus.UNDER_REVIEW, DisputeStatus.DISMISSED],
  [DisputeStatus.UNDER_REVIEW]: [
    DisputeStatus.EVIDENCE_REQUESTED,
    DisputeStatus.MEDIATION,
    DisputeStatus.RESOLVED,
    DisputeStatus.DISMISSED,
  ],
  [DisputeStatus.EVIDENCE_REQUESTED]: [
    DisputeStatus.UNDER_REVIEW,
    DisputeStatus.MEDIATION,
  ],
  [DisputeStatus.MEDIATION]: [
    DisputeStatus.RESOLVED,
    DisputeStatus.ESCALATED,
  ],
  [DisputeStatus.ESCALATED]: [DisputeStatus.RESOLVED, DisputeStatus.DISMISSED],
  [DisputeStatus.RESOLVED]: [],
  [DisputeStatus.DISMISSED]: [],
}

/**
 * Check if a dispute status transition is valid.
 */
export function canTransitionDispute(
  currentStatus: DisputeStatus,
  targetStatus: DisputeStatus,
): DisputeAction {
  const allowed = DISPUTE_TRANSITIONS[currentStatus]
  if (!allowed) {
    return { allowed: false, error: `Unknown dispute status: ${currentStatus}` }
  }

  if (!allowed.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
    }
  }

  return { allowed: true, error: null }
}

/**
 * Get available next statuses for a dispute.
 */
export function getAvailableDisputeTransitions(
  currentStatus: DisputeStatus,
): readonly DisputeStatus[] {
  return (DISPUTE_TRANSITIONS[currentStatus] ?? []) as DisputeStatus[]
}

// ── Payout Freeze ─────────────────────────────────────────────────────────

/**
 * Determine if payouts should be frozen for an asset.
 * Payouts are frozen when any active dispute exists.
 */
export function shouldFreezePayouts(
  assetId: string,
  disputes: readonly RightsDispute[],
): boolean {
  return disputes.some(
    (d) =>
      d.assetId === assetId &&
      d.payoutsFrozen &&
      d.status !== DisputeStatus.RESOLVED &&
      d.status !== DisputeStatus.DISMISSED,
  )
}

/**
 * Get all assets that currently have frozen payouts.
 */
export function getFrozenAssets(
  disputes: readonly RightsDispute[],
): string[] {
  const frozen = new Set<string>()
  for (const dispute of disputes) {
    if (
      dispute.payoutsFrozen &&
      dispute.status !== DisputeStatus.RESOLVED &&
      dispute.status !== DisputeStatus.DISMISSED
    ) {
      frozen.add(dispute.assetId)
    }
  }
  return [...frozen]
}
