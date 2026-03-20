/**
 * Zonga — Control Plane Bridge
 *
 * Bridges the @nzila/zonga-control-plane orchestration layer
 * into the application's command bus. All critical operations
 * pass through this bridge to enforce invariants, emit system
 * events, and produce audit metadata.
 */
import {
  emitSystemEvent,
  buildSystemEvent,
  checkAllInvariants,
  canExecutePayout,
  enforceEconomicIntegrity,
  validateGovernancePolicy,
  executeAdminAction,
  recordMetric,
  generateCorrelationId,
  AuditSeverity,
  MetricName,
} from '@nzila/zonga-control-plane'
import type {
  ControlPlaneContext,
  SystemEventType,
  AdminActionRequest,
  InvariantCheckResult,
  EconomicIntegrityResult,
  GovernancePolicyResult,
  AdminActionResult,
} from '@nzila/zonga-control-plane/types'
import type {
  LedgerEntry,
  LedgerTransaction,
  PayoutRecord,
  RevenueRecord,
} from '@nzila/zonga-control-plane'
import type { InvariantInput } from '@nzila/zonga-control-plane'
import type { CommandContext, CommandResult } from './types'
import { logger } from '@/lib/logger'

// ── Context Conversion ─────────────────────────────────────────────────────

export function toControlPlaneContext(ctx: CommandContext): ControlPlaneContext {
  return {
    orgId: ctx.org_id,
    actorId: ctx.actor_id ?? 'system',
    actorRole: 'operator',
    correlationId: ctx.correlation_id ?? generateCorrelationId(),
    requestId: ctx.correlation_id ?? generateCorrelationId(),
    timestamp: new Date(),
  }
}

// ── System Event Emission ──────────────────────────────────────────────────

export function emitCommandEvent(
  ctx: CommandContext,
  eventType: string,
  payload: Record<string, unknown>,
): void {
  const event = buildSystemEvent({
    type: eventType as SystemEventType,
    entityType: (payload['entity_type'] as string) ?? 'unknown',
    entityId: (payload['entity_id'] as string) ?? 'unknown',
    orgId: ctx.org_id,
    actorId: ctx.actor_id ?? 'system',
    correlationId: ctx.correlation_id ?? generateCorrelationId(),
    payload,
    severity: AuditSeverity.INFO,
  })
  emitSystemEvent(event)
}

// ── Payout Gating ──────────────────────────────────────────────────────────

export interface PayoutGateInput {
  creator_id: string
  amount: number
  currency: string
  ledgerEntries: LedgerEntry[]
  totalRevenue: number
  totalPayouts: number
  hasActiveDisputes: boolean
}

/**
 * Validates that a payout may proceed. Returns `{ allowed: true }` or
 * `{ allowed: false, reason }`. The caller should abort the payout when
 * `allowed` is false.
 */
export function gatePayout(input: PayoutGateInput): { allowed: boolean; reason?: string } {
  const availableBalance = input.totalRevenue - input.totalPayouts
  const hasLedgerBacking = input.ledgerEntries.length > 0
  const result = canExecutePayout(
    input.amount,
    availableBalance,
    input.hasActiveDisputes,
    hasLedgerBacking,
  )

  if (!result.allowed) {
    logger.warn('Control plane: payout blocked', {
      creatorId: input.creator_id,
      amount: input.amount,
      reasons: result.reasons,
    })
    return { allowed: false, reason: result.reasons.join('; ') }
  }

  return { allowed: true }
}

// ── Economic Integrity Check ───────────────────────────────────────────────

/**
 * Run economic integrity enforcement over the given transactions.
 * Returns the full economic integrity result.
 */
export function enforceEconomics(
  ctx: CommandContext,
  transactions: LedgerTransaction[],
  payouts: PayoutRecord[],
  revenues: RevenueRecord[],
): EconomicIntegrityResult {
  const cpCtx = toControlPlaneContext(ctx)
  const result = enforceEconomicIntegrity(cpCtx, transactions, payouts, revenues)

  if (!result.ledgerBalanced) {
    logger.error('Control plane: economic integrity violation', {
      orgId: ctx.org_id,
      discrepancy: result.discrepancy,
    })
    recordMetric(
      MetricName.LEDGER_INTEGRITY_FAILURES,
      1,
      { org_id: ctx.org_id },
    )
  }

  return result
}

// ── Governance Validation ──────────────────────────────────────────────────

/**
 * Validates an entity against registered governance policies.
 * Returns a structured result with any violations.
 */
export function validateGovernance(
  ctx: CommandContext,
  entityType: string,
  entity: Record<string, unknown>,
): GovernancePolicyResult {
  const cpCtx = toControlPlaneContext(ctx)
  return validateGovernancePolicy(cpCtx, entityType, entity)
}

/**
 * Wraps an admin action through the governance layer.
 * Requires reason ≥ 10 characters and appropriate role.
 */
export function executeAdminOp(
  request: AdminActionRequest,
): AdminActionResult {
  return executeAdminAction(request)
}

// ── System Invariant Check ─────────────────────────────────────────────────

/**
 * Runs all 9 system invariants and emits a system event on failure.
 * Returns the full check result.
 */
export function runInvariantCheck(ctx: CommandContext, input: InvariantInput): InvariantCheckResult {
  const cpCtx = toControlPlaneContext(ctx)
  const result = checkAllInvariants(cpCtx, input)

  if (!result.allPassed) {
    logger.error('Control plane: invariants broken', {
      orgId: ctx.org_id,
      failures: result.failures.map((f) => f.id),
    })
    emitCommandEvent(ctx, 'invariant.broken', {
      entity_type: 'system',
      entity_id: ctx.org_id,
      failures: result.failures.map((f) => ({
        invariant: f.id,
        details: f.details,
      })),
    })
  }

  return result
}

// ── Post-Command Hook ──────────────────────────────────────────────────────

/**
 * Called after every successful command execution. Emits the audit
 * event through the control plane event bus and records metrics.
 */
export function afterCommandSuccess(ctx: CommandContext, result: CommandResult): void {
  if (!result.entity_type || !result.entity_id) return

  emitCommandEvent(ctx, `${result.entity_type}.${result.status_after ?? 'completed'}`, {
    entity_type: result.entity_type,
    entity_id: result.entity_id,
    status_after: result.status_after,
    audit_ref: result.audit_ref,
  })

  recordMetric(
    MetricName.AUDIT_EVENTS_TOTAL,
    1,
    { org_id: ctx.org_id, entity_type: result.entity_type },
  )
}
