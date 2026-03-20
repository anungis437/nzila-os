/**
 * @nzila/zonga-control-plane — Dispute Impact Resolution
 *
 * When disputes are filed, this module determines the full
 * economic and operational impact: frozen payouts, blocked
 * royalty accruals, affected creators, and recommended actions.
 */
import type { ControlPlaneContext, DisputeImpactAssessment } from './types'
import { SystemEventType, AuditSeverity } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Dispute Types ─────────────────────────────────────────────────────────

export interface DisputeRecord {
  readonly id: string
  readonly type: 'payment' | 'ownership' | 'territory' | 'split' | 'takedown'
  readonly status: 'open' | 'in_review' | 'resolved' | 'dismissed' | 'escalated'
  readonly filedBy: string
  readonly targetCreatorId: string
  readonly relatedReleaseIds: readonly string[]
  readonly relatedPayoutIds: readonly string[]
  readonly relatedRoyaltyAccrualIds: readonly string[]
  readonly evidence: readonly DisputeEvidence[]
  readonly filedAt: Date
}

export interface DisputeEvidence {
  readonly id: string
  readonly type: 'document' | 'screenshot' | 'audio' | 'contract' | 'communication'
  readonly url: string
  readonly description: string
  readonly uploadedAt: Date
  readonly uploadedBy: string
}

/**
 * Assess the full impact of a dispute on the economic system.
 * Determines which payouts must be frozen, which creators are affected,
 * and what manual actions may be required.
 */
export function resolveDisputeImpact(
  context: ControlPlaneContext,
  dispute: DisputeRecord,
  relatedPayoutAmounts: readonly { payoutId: string; amount: number; creatorId: string }[],
  relatedRoyaltyAmounts: readonly { accrualId: string; amount: number; holderId: string }[],
): DisputeImpactAssessment {
  // Determine which payouts to freeze
  const frozenPayoutIds = dispute.relatedPayoutIds.length > 0
    ? [...dispute.relatedPayoutIds]
    : relatedPayoutAmounts
        .filter((p) => p.creatorId === dispute.targetCreatorId)
        .map((p) => p.payoutId)

  // Determine which royalty accruals to freeze
  const frozenRoyaltyAccrualIds = dispute.relatedRoyaltyAccrualIds.length > 0
    ? [...dispute.relatedRoyaltyAccrualIds]
    : relatedRoyaltyAmounts
        .filter((r) => r.holderId === dispute.targetCreatorId)
        .map((r) => r.accrualId)

  // Calculate total frozen amount
  const frozenPayoutTotal = relatedPayoutAmounts
    .filter((p) => frozenPayoutIds.includes(p.payoutId))
    .reduce((sum, p) => sum + p.amount, 0)

  const frozenRoyaltyTotal = relatedRoyaltyAmounts
    .filter((r) => frozenRoyaltyAccrualIds.includes(r.accrualId))
    .reduce((sum, r) => sum + r.amount, 0)

  const totalFrozenAmount = frozenPayoutTotal + frozenRoyaltyTotal

  // Identify all affected creators
  const affectedCreatorSet = new Set<string>()
  affectedCreatorSet.add(dispute.targetCreatorId)
  affectedCreatorSet.add(dispute.filedBy)
  for (const p of relatedPayoutAmounts) {
    if (frozenPayoutIds.includes(p.payoutId)) {
      affectedCreatorSet.add(p.creatorId)
    }
  }

  // Determine if manual review is needed
  const requiresManualReview =
    dispute.type === 'ownership' ||
    dispute.type === 'territory' ||
    totalFrozenAmount > 10000 ||
    frozenPayoutIds.length > 5

  // Recommend action
  let recommendedAction: string
  if (dispute.type === 'payment') {
    recommendedAction = 'Review payment records and reconcile with provider'
  } else if (dispute.type === 'ownership') {
    recommendedAction = 'Verify rights documentation and contract signatures'
  } else if (dispute.type === 'territory') {
    recommendedAction = 'Review territory rights and resolve geographic conflicts'
  } else if (dispute.type === 'split') {
    recommendedAction = 'Review split agreement history and obtain signatures'
  } else {
    recommendedAction = 'Escalate to legal review with full evidence pack'
  }

  const assessment: DisputeImpactAssessment = {
    disputeId: dispute.id,
    frozenPayoutIds,
    frozenRoyaltyAccrualIds,
    totalFrozenAmount,
    affectedCreators: [...affectedCreatorSet],
    requiresManualReview,
    recommendedAction,
  }

  // Emit freeze events
  if (frozenPayoutIds.length > 0) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.PAYOUT_FROZEN,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: dispute.id,
      entityType: 'dispute',
      correlationId: context.correlationId,
      payload: {
        frozenPayoutIds,
        frozenRoyaltyAccrualIds,
        totalFrozenAmount,
        disputeType: dispute.type,
      },
      severity: AuditSeverity.WARNING,
    }))
  }

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.RIGHTS_DISPUTE_FILED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: dispute.id,
    entityType: 'dispute',
    correlationId: context.correlationId,
    payload: {
      disputeType: dispute.type,
      targetCreator: dispute.targetCreatorId,
      affectedCreators: [...affectedCreatorSet],
      totalFrozenAmount,
      requiresManualReview,
      recommendedAction,
    },
    severity: AuditSeverity.WARNING,
  }))

  return assessment
}

/**
 * Unfreeze payouts and accruals when a dispute is resolved.
 */
export function resolveDisputeFreeze(
  context: ControlPlaneContext,
  disputeId: string,
  resolution: 'in_favor_of_filer' | 'in_favor_of_target' | 'split' | 'dismissed',
  frozenPayoutIds: readonly string[],
  frozenRoyaltyAccrualIds: readonly string[],
): {
  unfrozenPayoutIds: readonly string[]
  unfrozenRoyaltyAccrualIds: readonly string[]
  requiresPayoutAdjustment: boolean
} {
  let unfrozenPayoutIds: string[]
  let unfrozenRoyaltyAccrualIds: string[]
  let requiresPayoutAdjustment = false

  switch (resolution) {
    case 'in_favor_of_target':
    case 'dismissed':
      // Unfreeze everything — dispute not valid
      unfrozenPayoutIds = [...frozenPayoutIds]
      unfrozenRoyaltyAccrualIds = [...frozenRoyaltyAccrualIds]
      break

    case 'in_favor_of_filer':
      // Payouts need adjustment — filer was correct
      unfrozenPayoutIds = []
      unfrozenRoyaltyAccrualIds = []
      requiresPayoutAdjustment = true
      break

    case 'split':
      // Partial unfreeze — some adjustments needed
      unfrozenPayoutIds = [...frozenPayoutIds]
      unfrozenRoyaltyAccrualIds = [...frozenRoyaltyAccrualIds]
      requiresPayoutAdjustment = true
      break
  }

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.PAYOUT_UNFROZEN,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: disputeId,
    entityType: 'dispute',
    correlationId: context.correlationId,
    payload: {
      resolution,
      unfrozenPayoutIds,
      unfrozenRoyaltyAccrualIds,
      requiresPayoutAdjustment,
    },
    severity: AuditSeverity.INFO,
  }))

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.RIGHTS_DISPUTE_RESOLVED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: disputeId,
    entityType: 'dispute',
    correlationId: context.correlationId,
    payload: { resolution },
    severity: AuditSeverity.INFO,
  }))

  return { unfrozenPayoutIds, unfrozenRoyaltyAccrualIds, requiresPayoutAdjustment }
}
