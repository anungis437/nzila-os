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
  validateLedgerIntegrity,
  enforceEconomicIntegrity,
  validateGovernancePolicy,
  executeAdminAction,
  recordMetric,
  generateCorrelationId,
} from '@nzila/zonga-control-plane'
import type {
  ControlPlaneContext,
  SystemEvent,
  LedgerEntry,
  SplitAllocation,
  AuditableAction,
  AdminActionRequest,
} from '@nzila/zonga-control-plane/types'
import type { CommandContext, CommandResult } from './types'
import { logger } from '@/lib/logger'

// ── Context Conversion ─────────────────────────────────────────────────────

export function toControlPlaneContext(ctx: CommandContext): ControlPlaneContext {
  return {
    org_id: ctx.org_id,
    actor_id: ctx.actor_id ?? 'system',
    role: 'operator',
    permissions: [],
    correlation_id: ctx.correlation_id ?? generateCorrelationId(),
    request_id: ctx.correlation_id ?? generateCorrelationId(),
  }
}

// ── System Event Emission ──────────────────────────────────────────────────

export function emitCommandEvent(
  ctx: CommandContext,
  eventType: string,
  payload: Record<string, unknown>,
): void {
  const event = buildSystemEvent({
    type: eventType as SystemEvent['type'],
    entity_type: (payload['entity_type'] as string) ?? 'unknown',
    entity_id: (payload['entity_id'] as string) ?? 'unknown',
    org_id: ctx.org_id,
    actor_id: ctx.actor_id ?? 'system',
    correlation_id: ctx.correlation_id ?? generateCorrelationId(),
    metadata: payload,
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
  const result = canExecutePayout({
    creatorId: input.creator_id,
    requestedAmount: input.amount,
    currentBalance: input.totalRevenue - input.totalPayouts,
    hasActiveDisputes: input.hasActiveDisputes,
    ledgerEntries: input.ledgerEntries,
  })

  if (!result.allowed) {
    logger.warn('Control plane: payout blocked', {
      creatorId: input.creator_id,
      amount: input.amount,
      reason: result.reason,
    })
    return { allowed: false, reason: result.reason }
  }

  return { allowed: true }
}

// ── Economic Integrity Check ───────────────────────────────────────────────

/**
 * Run economic integrity enforcement over the given ledger entries.
 * Returns violations if the ledger is not balanced.
 */
export function enforceEconomics(
  ctx: CommandContext,
  ledgerEntries: LedgerEntry[],
): { valid: boolean; violations: string[] } {
  const cpCtx = toControlPlaneContext(ctx)
  const result = enforceEconomicIntegrity(cpCtx, ledgerEntries)

  if (!result.valid) {
    logger.error('Control plane: economic integrity violation', {
      orgId: ctx.org_id,
      violations: result.violations,
    })
    recordMetric({
      name: 'economic_integrity_violation',
      value: result.violations.length,
      tags: { org_id: ctx.org_id },
    })
  }

  return result
}

// ── Governance Validation ──────────────────────────────────────────────────

/**
 * Validates an action against registered governance policies.
 * Returns a structured result with any violations.
 */
export function validateGovernance(
  ctx: CommandContext,
  action: AuditableAction,
): { passed: boolean; violations: Array<{ policy: string; reason: string }> } {
  const cpCtx = toControlPlaneContext(ctx)
  return validateGovernancePolicy(cpCtx, action)
}

/**
 * Wraps an admin action through the governance layer.
 * Requires reason ≥ 10 characters and appropriate role.
 */
export async function executeAdminOp(
  ctx: CommandContext,
  request: AdminActionRequest,
): Promise<{ success: boolean; action_id?: string; violations?: Array<{ policy: string; reason: string }> }> {
  const cpCtx = toControlPlaneContext(ctx)
  return executeAdminAction(cpCtx, request)
}

// ── System Invariant Check ─────────────────────────────────────────────────

export interface InvariantInput {
  ledgerEntries: LedgerEntry[]
  splits: SplitAllocation[]
  recentActions: AuditableAction[]
  eventCapacities: Array<{ event_id: string; capacity: number; tickets_sold: number }>
}

/**
 * Runs all 9 system invariants and emits a system event on failure.
 * Returns the full check result.
 */
export function runInvariantCheck(ctx: CommandContext, input: InvariantInput) {
  const cpCtx = toControlPlaneContext(ctx)
  const result = checkAllInvariants(cpCtx, {
    ledgerEntries: input.ledgerEntries,
    splits: input.splits,
    recentActions: input.recentActions,
    eventCapacities: input.eventCapacities,
  })

  if (!result.passed) {
    const failures = result.results.filter(r => !r.passed)
    logger.error('Control plane: invariants broken', {
      orgId: ctx.org_id,
      failures: failures.map(f => f.invariant_id),
    })
    emitCommandEvent(ctx, 'invariant.broken', {
      entity_type: 'system',
      entity_id: ctx.org_id,
      failures: failures.map(f => ({
        invariant: f.invariant_id,
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

  recordMetric({
    name: 'command_executed',
    value: 1,
    tags: {
      org_id: ctx.org_id,
      entity_type: result.entity_type,
    },
  })
}
