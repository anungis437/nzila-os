/**
 * @nzila/zonga-control-plane — System Invariant Checker
 *
 * Enforces the non-negotiable invariants that must hold true globally:
 *
 * - No revenue without ledger entry
 * - No payout without ledger backing
 * - No event oversell
 * - No invalid rights split
 * - No auditless action
 * - No workflow bypass
 * - Ledger always balanced
 * - No negative payout without explicit rule
 * - Splits always sum to 100%
 */
import type { InvariantCheck, InvariantCheckResult, ControlPlaneContext } from './types'
import { InvariantId, AuditSeverity, SystemEventType } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Invariant Definitions ─────────────────────────────────────────────────

export interface InvariantInput {
  /** Revenue events and whether each has a ledger entry */
  revenueRecords?: readonly { id: string; hasLedgerEntry: boolean }[]
  /** Payout records and whether each has ledger backing */
  payoutRecords?: readonly { id: string; hasLedgerBacking: boolean; amount: number }[]
  /** Events with capacity and tickets sold */
  eventRecords?: readonly { id: string; capacity: number; ticketsSold: number }[]
  /** Releases with their split totals */
  splitRecords?: readonly { releaseId: string; splitTotal: number }[]
  /** Recent actions and whether each has an audit event */
  actionRecords?: readonly { actionId: string; hasAuditEvent: boolean }[]
  /** Recent critical operations and whether they went through workflow */
  workflowRecords?: readonly { operationId: string; executedViaWorkflow: boolean }[]
  /** Ledger balance check */
  ledgerDebits?: number
  ledgerCredits?: number
}

/**
 * Run all system invariant checks.
 * Returns a comprehensive result with per-invariant detail.
 */
export function checkAllInvariants(
  context: ControlPlaneContext,
  input: InvariantInput,
): InvariantCheckResult {
  const checks: InvariantCheck[] = []
  const now = new Date()

  // Invariant 1: No revenue without ledger entry
  if (input.revenueRecords) {
    const missing = input.revenueRecords.filter((r) => !r.hasLedgerEntry)
    checks.push({
      id: InvariantId.NO_REVENUE_WITHOUT_LEDGER,
      name: 'No revenue without ledger entry',
      passed: missing.length === 0,
      details: missing.length > 0
        ? `${missing.length} revenue events without ledger entries: ${missing.map((r) => r.id).join(', ')}`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 2: No payout without ledger backing
  if (input.payoutRecords) {
    const unbacked = input.payoutRecords.filter((p) => !p.hasLedgerBacking)
    checks.push({
      id: InvariantId.NO_PAYOUT_WITHOUT_BACKING,
      name: 'No payout without ledger backing',
      passed: unbacked.length === 0,
      details: unbacked.length > 0
        ? `${unbacked.length} payouts without ledger backing: ${unbacked.map((p) => p.id).join(', ')}`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 3: No negative payout without explicit rule
  if (input.payoutRecords) {
    const negativePayout = input.payoutRecords.filter((p) => p.amount < 0)
    checks.push({
      id: InvariantId.NO_NEGATIVE_PAYOUT,
      name: 'No negative payout without explicit rule',
      passed: negativePayout.length === 0,
      details: negativePayout.length > 0
        ? `${negativePayout.length} negative payouts detected: ${negativePayout.map((p) => p.id).join(', ')}`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 4: No event oversell
  if (input.eventRecords) {
    const oversold = input.eventRecords.filter((e) => e.ticketsSold > e.capacity)
    checks.push({
      id: InvariantId.NO_EVENT_OVERSELL,
      name: 'No event oversell',
      passed: oversold.length === 0,
      details: oversold.length > 0
        ? `${oversold.length} events oversold: ${oversold.map((e) => `${e.id} (${e.ticketsSold}/${e.capacity})`).join(', ')}`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 5: No invalid rights split
  if (input.splitRecords) {
    const invalid = input.splitRecords.filter((s) => Math.abs(s.splitTotal - 100) > 0.001)
    checks.push({
      id: InvariantId.NO_INVALID_RIGHTS_SPLIT,
      name: 'No invalid rights split',
      passed: invalid.length === 0,
      details: invalid.length > 0
        ? `${invalid.length} releases with invalid splits: ${invalid.map((s) => `${s.releaseId} (${s.splitTotal}%)`).join(', ')}`
        : undefined,
      checkedAt: now,
    })
    checks.push({
      id: InvariantId.SPLITS_SUM_100,
      name: 'Splits always sum to 100%',
      passed: invalid.length === 0,
      details: invalid.length > 0
        ? `${invalid.length} releases with splits != 100%`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 6: No auditless action
  if (input.actionRecords) {
    const unaudited = input.actionRecords.filter((a) => !a.hasAuditEvent)
    checks.push({
      id: InvariantId.NO_AUDITLESS_ACTION,
      name: 'No auditless action',
      passed: unaudited.length === 0,
      details: unaudited.length > 0
        ? `${unaudited.length} actions without audit events: ${unaudited.map((a) => a.actionId).join(', ')}`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 7: No workflow bypass
  if (input.workflowRecords) {
    const bypassed = input.workflowRecords.filter((w) => !w.executedViaWorkflow)
    checks.push({
      id: InvariantId.NO_WORKFLOW_BYPASS,
      name: 'No workflow bypass',
      passed: bypassed.length === 0,
      details: bypassed.length > 0
        ? `${bypassed.length} operations bypassed workflow: ${bypassed.map((w) => w.operationId).join(', ')}`
        : undefined,
      checkedAt: now,
    })
  }

  // Invariant 8: Ledger balanced
  if (input.ledgerDebits !== undefined && input.ledgerCredits !== undefined) {
    const discrepancy = Math.abs(input.ledgerDebits - input.ledgerCredits)
    checks.push({
      id: InvariantId.LEDGER_BALANCED,
      name: 'Ledger always balanced',
      passed: discrepancy < 0.001,
      details: discrepancy >= 0.001
        ? `Ledger imbalance: debits=${input.ledgerDebits.toFixed(4)}, credits=${input.ledgerCredits.toFixed(4)}, discrepancy=${discrepancy.toFixed(4)}`
        : undefined,
      checkedAt: now,
    })
  }

  const failures = checks.filter((c) => !c.passed)

  // Emit events for failures
  for (const failure of failures) {
    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.INVARIANT_VIOLATION_DETECTED,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: failure.id,
      entityType: 'invariant',
      correlationId: context.correlationId,
      payload: { invariantId: failure.id, name: failure.name, details: failure.details },
      severity: AuditSeverity.CRITICAL,
    }))
  }

  return {
    allPassed: failures.length === 0,
    checks,
    failures,
    checkedAt: now,
  }
}

/**
 * Run a single invariant check by ID.
 */
export function checkInvariant(
  context: ControlPlaneContext,
  invariantId: InvariantId,
  input: InvariantInput,
): InvariantCheck {
  const result = checkAllInvariants(context, input)
  const check = result.checks.find((c) => c.id === invariantId)
  if (!check) {
    return {
      id: invariantId,
      name: invariantId,
      passed: false,
      details: `Invariant ${invariantId} not applicable with provided input`,
      checkedAt: new Date(),
    }
  }
  return check
}
