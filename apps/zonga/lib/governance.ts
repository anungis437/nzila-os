/**
 * Zonga — Governance Policy Bridge
 *
 * Defines Zonga-specific governance gates and policy thresholds for
 * creator payouts, content releases, event management, and rights disputes.
 *
 * Follows the platform governance pattern from @nzila/commerce-governance:
 * pure guard functions, configurable per-org thresholds, audit trail integration.
 */

// ── Zonga Governance Policy ─────────────────────────────────────────────────

/**
 * Zonga-specific governance policy — configurable per org.
 */
export interface ZongaPolicy {
  /** Minimum payout amount before a transfer can be initiated */
  readonly payoutMinimumThreshold: number
  /** Payout amount above which manager+ approval is required */
  readonly payoutApprovalThreshold: number
  /** Maximum permitted automatic moderation batch without human review */
  readonly autoModerationBatchLimit: number
  /** Number of resolved copyright cases before creator suspension */
  readonly copyrightStrikeLimit: number
  /** Minimum margin percent on ticket pricing (after platform fee) */
  readonly ticketMinMarginPercent: number
  /** Maximum refund window in hours for tickets */
  readonly refundWindowHours: number
  /** Whether evidence packs are required for payout execution */
  readonly requirePayoutEvidence: boolean
  /** Whether collaborator splits must be finalized before release publish */
  readonly requireFinalizedSplits: boolean
  /** Maximum event ticket price (fraud prevention) */
  readonly maxTicketPrice: number
  /** Minimum days notice before event can be cancelled */
  readonly minCancellationNoticeDays: number
}

const DEFAULT_ZONGA_POLICY: ZongaPolicy = {
  payoutMinimumThreshold: 10,
  payoutApprovalThreshold: 5_000,
  autoModerationBatchLimit: 50,
  copyrightStrikeLimit: 3,
  ticketMinMarginPercent: 5,
  refundWindowHours: 48,
  requirePayoutEvidence: true,
  requireFinalizedSplits: true,
  maxTicketPrice: 50_000,
  minCancellationNoticeDays: 2,
} as const

export function resolveZongaPolicy(partial?: Partial<ZongaPolicy>): ZongaPolicy {
  if (!partial) return DEFAULT_ZONGA_POLICY
  return { ...DEFAULT_ZONGA_POLICY, ...partial }
}

// ── Gate Result ─────────────────────────────────────────────────────────────

export interface ZongaGateResult {
  readonly gate: string
  readonly passed: boolean
  readonly reason: string
  readonly metadata?: Record<string, unknown>
}

// ── Entity Shapes ───────────────────────────────────────────────────────────

export interface PayoutEntity {
  readonly orgId: string
  readonly creatorId: string
  readonly amount: number
  readonly currency: string
  readonly hasApproval: boolean
  readonly hasEvidencePack: boolean
  readonly pendingDisputeCount: number
}

export interface ReleaseEntity {
  readonly orgId: string
  readonly hasAudio: boolean
  readonly hasCoverArt: boolean
  readonly hasMetadata: boolean
  readonly hasFinalizedSplits: boolean
  readonly pendingIntegritySignals: number
  readonly collaboratorCount: number
}

export interface EventEntity {
  readonly orgId: string
  readonly hasVenue: boolean
  readonly hasDate: boolean
  readonly ticketTypeCount: number
  readonly maxTicketPrice: number
  readonly eventDate: string
}

export interface CreatorEntity {
  readonly orgId: string
  readonly status: string
  readonly profileComplete: boolean
  readonly payoutConfigured: boolean
  readonly copyrightStrikeCount: number
}

// ── Gate Factories ──────────────────────────────────────────────────────────

/**
 * Payout minimum threshold gate — blocks payouts below configured minimum.
 */
export function evaluatePayoutMinimumGate(
  entity: PayoutEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult {
  const p = resolveZongaPolicy(policy)
  const passed = entity.amount >= p.payoutMinimumThreshold
  return {
    gate: 'payout_minimum_threshold',
    passed,
    reason: passed
      ? `Amount ${entity.amount} meets minimum threshold ${p.payoutMinimumThreshold}`
      : `Amount ${entity.amount} below minimum threshold ${p.payoutMinimumThreshold}`,
    metadata: { amount: entity.amount, threshold: p.payoutMinimumThreshold },
  }
}

/**
 * Payout approval gate — requires manager approval above threshold.
 */
export function evaluatePayoutApprovalGate(
  entity: PayoutEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult {
  const p = resolveZongaPolicy(policy)
  if (entity.amount <= p.payoutApprovalThreshold) {
    return {
      gate: 'payout_approval_required',
      passed: true,
      reason: `Amount ${entity.amount} below approval threshold ${p.payoutApprovalThreshold}`,
    }
  }
  return {
    gate: 'payout_approval_required',
    passed: entity.hasApproval,
    reason: entity.hasApproval
      ? 'Approval granted for high-value payout'
      : `Amount ${entity.amount} exceeds threshold ${p.payoutApprovalThreshold} — approval required`,
    metadata: { amount: entity.amount, threshold: p.payoutApprovalThreshold },
  }
}

/**
 * Payout evidence gate — requires evidence pack for audit compliance.
 */
export function evaluatePayoutEvidenceGate(
  entity: PayoutEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult {
  const p = resolveZongaPolicy(policy)
  if (!p.requirePayoutEvidence) {
    return { gate: 'payout_evidence_required', passed: true, reason: 'Evidence not required by policy' }
  }
  return {
    gate: 'payout_evidence_required',
    passed: entity.hasEvidencePack,
    reason: entity.hasEvidencePack
      ? 'Evidence pack attached'
      : 'Evidence pack required for payout execution',
  }
}

/**
 * Payout dispute freeze gate — blocks payouts when disputes are pending.
 */
export function evaluatePayoutDisputeFreezeGate(entity: PayoutEntity): ZongaGateResult {
  const passed = entity.pendingDisputeCount === 0
  return {
    gate: 'payout_dispute_freeze',
    passed,
    reason: passed
      ? 'No pending disputes on creator'
      : `${entity.pendingDisputeCount} pending dispute(s) — payouts frozen`,
    metadata: { pendingDisputeCount: entity.pendingDisputeCount },
  }
}

/**
 * Evaluate all payout gates in sequence.
 */
export function evaluatePayoutGates(
  entity: PayoutEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult[] {
  return [
    evaluatePayoutMinimumGate(entity, policy),
    evaluatePayoutApprovalGate(entity, policy),
    evaluatePayoutEvidenceGate(entity, policy),
    evaluatePayoutDisputeFreezeGate(entity),
  ]
}

/**
 * Release publication readiness gate — all pre-publication checks.
 */
export function evaluateReleasePublishGates(
  entity: ReleaseEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult[] {
  const p = resolveZongaPolicy(policy)
  const gates: ZongaGateResult[] = [
    {
      gate: 'release_audio_uploaded',
      passed: entity.hasAudio,
      reason: entity.hasAudio ? 'Audio file uploaded' : 'Audio file required for publication',
    },
    {
      gate: 'release_cover_art',
      passed: entity.hasCoverArt,
      reason: entity.hasCoverArt ? 'Cover art attached' : 'Cover art required for publication',
    },
    {
      gate: 'release_metadata_complete',
      passed: entity.hasMetadata,
      reason: entity.hasMetadata ? 'Metadata complete' : 'Metadata incomplete (title, genre required)',
    },
    {
      gate: 'release_no_pending_signals',
      passed: entity.pendingIntegritySignals === 0,
      reason: entity.pendingIntegritySignals === 0
        ? 'No pending integrity signals'
        : `${entity.pendingIntegritySignals} pending integrity signal(s) must be resolved`,
    },
  ]

  if (p.requireFinalizedSplits && entity.collaboratorCount > 0) {
    gates.push({
      gate: 'release_splits_finalized',
      passed: entity.hasFinalizedSplits,
      reason: entity.hasFinalizedSplits
        ? 'Collaborator splits finalized'
        : 'Collaborator splits must be finalized before publication',
    })
  }

  return gates
}

/**
 * Event publication readiness gate.
 */
export function evaluateEventPublishGates(
  entity: EventEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult[] {
  const p = resolveZongaPolicy(policy)
  return [
    {
      gate: 'event_has_venue',
      passed: entity.hasVenue,
      reason: entity.hasVenue ? 'Venue confirmed' : 'Venue required for event publication',
    },
    {
      gate: 'event_has_date',
      passed: entity.hasDate,
      reason: entity.hasDate ? 'Event date set' : 'Event date required for publication',
    },
    {
      gate: 'event_has_tickets',
      passed: entity.ticketTypeCount > 0,
      reason: entity.ticketTypeCount > 0
        ? `${entity.ticketTypeCount} ticket type(s) configured`
        : 'At least one ticket type required',
    },
    {
      gate: 'event_ticket_price_cap',
      passed: entity.maxTicketPrice <= p.maxTicketPrice,
      reason: entity.maxTicketPrice <= p.maxTicketPrice
        ? 'Ticket price within platform limits'
        : `Max ticket price ${entity.maxTicketPrice} exceeds cap ${p.maxTicketPrice}`,
      metadata: { maxTicketPrice: entity.maxTicketPrice, cap: p.maxTicketPrice },
    },
  ]
}

/**
 * Creator suspension gate — checks if copyright strike limit is reached.
 */
export function evaluateCreatorSuspensionGate(
  entity: CreatorEntity,
  policy?: Partial<ZongaPolicy>,
): ZongaGateResult {
  const p = resolveZongaPolicy(policy)
  const shouldSuspend = entity.copyrightStrikeCount >= p.copyrightStrikeLimit
  return {
    gate: 'creator_copyright_strikes',
    passed: !shouldSuspend,
    reason: shouldSuspend
      ? `Creator has ${entity.copyrightStrikeCount} copyright strikes (limit: ${p.copyrightStrikeLimit}) — suspension required`
      : `Creator has ${entity.copyrightStrikeCount}/${p.copyrightStrikeLimit} copyright strikes`,
    metadata: { strikes: entity.copyrightStrikeCount, limit: p.copyrightStrikeLimit },
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

/**
 * Check if all gates in a result set passed.
 */
export function allGatesPassed(results: readonly ZongaGateResult[]): boolean {
  return results.every(r => r.passed)
}

/**
 * Get only failed gates from a result set.
 */
export function failedGates(results: readonly ZongaGateResult[]): ZongaGateResult[] {
  return results.filter(r => !r.passed)
}
