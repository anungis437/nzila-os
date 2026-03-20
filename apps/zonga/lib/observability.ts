/**
 * Zonga — Observability Integration
 *
 * Structured logging and metrics for Zonga-specific domain events.
 * Extends the platform commerce-observability layer with Zonga domain spans,
 * metrics, and health checks.
 */

// Re-export platform observability
export {
  logTransition,
  logSagaExecution,
  logGovernanceGate,
  logOrgMismatch,
  logEvidencePack,
  logAuditTrail,
  buildTransitionSpanAttrs,
  buildGateSpanAttrs,
  COMMERCE_SPAN,
  COMMERCE_METRIC,
  commerceMetrics,
  COMMERCE_HEALTH_CHECKS,
  buildHealthResult,
  aggregateHealth,
} from '@nzila/commerce-observability'

// ── Zonga Domain Metrics ────────────────────────────────────────────────────

/** Zonga-specific metric names, all prefixed to avoid collision. */
export const ZONGA_METRIC = {
  // Streaming
  stream_play_total: 'zonga_stream_play_total',
  stream_play_duration_ms: 'zonga_stream_play_duration_ms',
  stream_skip_total: 'zonga_stream_skip_total',
  stream_fraud_flag_total: 'zonga_stream_fraud_flag_total',

  // Payouts
  payout_initiated_total: 'zonga_payout_initiated_total',
  payout_completed_total: 'zonga_payout_completed_total',
  payout_failed_total: 'zonga_payout_failed_total',
  payout_amount_total: 'zonga_payout_amount_total',
  payout_duration_ms: 'zonga_payout_duration_ms',

  // Content
  release_published_total: 'zonga_release_published_total',
  release_moderation_total: 'zonga_release_moderation_total',
  release_rejected_total: 'zonga_release_rejected_total',

  // Events
  event_published_total: 'zonga_event_published_total',
  ticket_sold_total: 'zonga_ticket_sold_total',
  ticket_refund_total: 'zonga_ticket_refund_total',
  checkin_scan_total: 'zonga_checkin_scan_total',
  checkin_offline_conflict_total: 'zonga_checkin_offline_conflict_total',

  // Governance
  governance_gate_evaluated_total: 'zonga_governance_gate_evaluated_total',
  governance_gate_failed_total: 'zonga_governance_gate_failed_total',

  // Rights
  dispute_filed_total: 'zonga_dispute_filed_total',
  dispute_resolved_total: 'zonga_dispute_resolved_total',
  royalty_accrual_total: 'zonga_royalty_accrual_total',
} as const

/** Zonga-specific span names. */
export const ZONGA_SPAN = {
  stream_play: 'zonga.stream.play',
  payout_execute: 'zonga.payout.execute',
  release_publish: 'zonga.release.publish',
  release_moderate: 'zonga.release.moderate',
  event_publish: 'zonga.event.publish',
  ticket_purchase: 'zonga.ticket.purchase',
  ticket_refund: 'zonga.ticket.refund',
  checkin_scan: 'zonga.checkin.scan',
  dispute_file: 'zonga.dispute.file',
  royalty_calculate: 'zonga.royalty.calculate',
  governance_evaluate: 'zonga.governance.evaluate',
  settlement_batch: 'zonga.settlement.batch',
} as const

// ── Health Checks ───────────────────────────────────────────────────────────

export const ZONGA_HEALTH_CHECKS = {
  database: { name: 'zonga_database', critical: true },
  stripe: { name: 'zonga_stripe_connect', critical: true },
  storage: { name: 'zonga_blob_storage', critical: false },
  moderation: { name: 'zonga_moderation_queue', critical: false },
  settlement: { name: 'zonga_settlement_engine', critical: false },
} as const

// ── Structured Log Helpers ──────────────────────────────────────────────────

export interface ZongaLogContext {
  readonly orgId: string
  readonly actorId?: string
  readonly traceId?: string
  readonly spanId?: string
}

/**
 * Build structured log attributes for a Zonga payout event.
 */
export function buildPayoutLogAttrs(ctx: ZongaLogContext, attrs: {
  payoutId: string
  creatorId: string
  amount: number
  currency: string
  rail: string
  status: string
}) {
  return {
    'zonga.payout.id': attrs.payoutId,
    'zonga.payout.creator_id': attrs.creatorId,
    'zonga.payout.amount': attrs.amount,
    'zonga.payout.currency': attrs.currency,
    'zonga.payout.rail': attrs.rail,
    'zonga.payout.status': attrs.status,
    'nzila.org_id': ctx.orgId,
    'nzila.actor_id': ctx.actorId,
    'nzila.trace_id': ctx.traceId,
  }
}

/**
 * Build structured log attributes for a streaming event.
 */
export function buildStreamLogAttrs(ctx: ZongaLogContext, attrs: {
  trackId: string
  listenerId: string
  durationMs: number
  quality: string
  offline: boolean
}) {
  return {
    'zonga.stream.track_id': attrs.trackId,
    'zonga.stream.listener_id': attrs.listenerId,
    'zonga.stream.duration_ms': attrs.durationMs,
    'zonga.stream.quality': attrs.quality,
    'zonga.stream.offline': attrs.offline,
    'nzila.org_id': ctx.orgId,
  }
}

/**
 * Build structured log attributes for a governance gate evaluation.
 */
export function buildGovernanceLogAttrs(ctx: ZongaLogContext, attrs: {
  gate: string
  passed: boolean
  reason: string
  entityType: string
  entityId: string
}) {
  return {
    'zonga.governance.gate': attrs.gate,
    'zonga.governance.passed': attrs.passed,
    'zonga.governance.reason': attrs.reason,
    'zonga.governance.entity_type': attrs.entityType,
    'zonga.governance.entity_id': attrs.entityId,
    'nzila.org_id': ctx.orgId,
    'nzila.actor_id': ctx.actorId,
  }
}
