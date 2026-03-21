/**
 * @nzila/zonga-control-plane — Cross-Cutting Property Tests
 *
 * Validates system-wide invariants that span multiple modules:
 *   - Determinism: same inputs → same outputs under repeated execution
 *   - Idempotency: repeated operations don't produce divergent state
 *   - Audit completeness: every critical path emits system events
 *   - Observability coverage: metrics recorded for all failure classes
 *   - Module integration: orchestrator + enforcer + invariant synergy
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkAllInvariants, type InvariantInput } from './invariant-checker'
import {
  validateLedgerIntegrity,
  canExecutePayout,
  reconcileAccounts,
  type LedgerEntry,
} from './economic-enforcer'
import {
  validateGovernancePolicy,
  executeAdminAction,
} from './governance-enforcer'
import {
  resolveDisputeImpact,
  resolveDisputeFreeze,
  type DisputeRecord,
} from './dispute-impact'
import {
  executeControlledInference,
  runFraudCheck,
  setFeatureFlag,
  AIFeatureFlag,
} from './ai-controller'
import {
  getMetrics,
  clearMetrics,
  MetricName,
} from './observability'
import {
  clearEventLog,
  getEventLog,
} from './system-events'
import type { ControlPlaneContext } from './types'
import { WorkflowId, InvariantId, AuditSeverity, SystemEventType } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────

let _ctr = 0
function nextId(prefix = 'xcut'): string {
  return `${prefix}_${Date.now()}_${++_ctr}`
}

function makeContext(overrides: Partial<ControlPlaneContext> = {}): ControlPlaneContext {
  return {
    orgId: nextId('org'),
    actorId: nextId('actor'),
    actorRole: 'admin',
    correlationId: nextId('corr'),
    requestId: nextId('req'),
    timestamp: new Date(),
    ...overrides,
  }
}

function makeDispute(overrides: Partial<DisputeRecord> = {}): DisputeRecord {
  return {
    id: nextId('dispute'),
    type: 'payment',
    status: 'open',
    filedBy: nextId('filer'),
    targetCreatorId: nextId('target'),
    relatedReleaseIds: [],
    relatedPayoutIds: [],
    relatedRoyaltyAccrualIds: [],
    evidence: [],
    filedAt: new Date(),
    ...overrides,
  }
}

function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: nextId('le'),
    transactionId: nextId('tx'),
    accountId: nextId('acc'),
    direction: 'credit',
    amount: 100,
    currency: 'USD',
    createdAt: new Date(),
    ...overrides,
  }
}

function makeValidInvariantInput(): InvariantInput {
  return {
    revenueRecords: [{ id: nextId('rev'), hasLedgerEntry: true }],
    payoutRecords: [{ id: nextId('po'), hasLedgerBacking: true, amount: 100 }],
    eventRecords: [{ id: nextId('ev'), capacity: 100, ticketsSold: 50 }],
    splitRecords: [{ releaseId: nextId('rel'), splitTotal: 100 }],
    actionRecords: [{ actionId: nextId('act'), hasAuditEvent: true }],
    workflowRecords: [{ operationId: nextId('op'), executedViaWorkflow: true }],
    ledgerDebits: 1000,
    ledgerCredits: 1000,
  }
}

// ── Cross-Cutting: Determinism ────────────────────────────────────────────

describe('Cross-cutting: Determinism under repeated execution', () => {
  it('invariant checker is deterministic across 100 runs', () => {
    const ctx = makeContext()
    const input = makeValidInvariantInput()
    const results = Array.from({ length: 100 }, () => checkAllInvariants(ctx, input))
    const first = results[0]!
    for (const r of results) {
      expect(r.allPassed).toBe(first.allPassed)
      expect(r.failures.length).toBe(first.failures.length)
    }
  })

  it('ledger integrity validation is deterministic', () => {
    const entries = [
      makeLedgerEntry({ direction: 'credit', amount: 500 }),
      makeLedgerEntry({ direction: 'debit', amount: 500 }),
    ]
    const results = Array.from({ length: 50 }, () => validateLedgerIntegrity(entries))
    expect(results.every((r) => r.valid === true)).toBe(true)
  })

  it('governance policy validation is deterministic', () => {
    const ctx = makeContext()
    const entity = { id: nextId('payout'), amount: 0.5, hasActiveDispute: true }
    const results = Array.from({ length: 50 }, () =>
      validateGovernancePolicy(ctx, 'payout', entity),
    )
    const firstViolationCount = results[0]!.violations.length
    expect(results.every((r) => r.violations.length === firstViolationCount)).toBe(true)
    expect(results.every((r) => r.passed === false)).toBe(true)
  })

  it('fraud scoring is deterministic for same signals', () => {
    const ctx = makeContext()
    const request = {
      entityType: 'ticket_purchase' as const,
      entityId: nextId('tkt'),
      signals: [
        { type: 'velocity' as const, value: 15, threshold: 10, description: 'test' },
        { type: 'geographic' as const, value: 8, threshold: 5, description: 'test' },
      ],
    }
    const results = Array.from({ length: 50 }, () => runFraudCheck(ctx, request))
    const firstScore = results[0]!.score
    expect(results.every((r) => r.score === firstScore)).toBe(true)
    expect(results.every((r) => r.riskLevel === results[0]!.riskLevel)).toBe(true)
  })

  it('dispute impact is deterministic', () => {
    const ctx = makeContext()
    const payoutIds = [nextId('po'), nextId('po')]
    const dispute = makeDispute({ relatedPayoutIds: payoutIds })
    const payouts = payoutIds.map((id) => ({
      payoutId: id, amount: 500, creatorId: dispute.targetCreatorId,
    }))
    const results = Array.from({ length: 50 }, () =>
      resolveDisputeImpact(ctx, dispute, payouts, []),
    )
    expect(results.every((r) => r.totalFrozenAmount === 1000)).toBe(true)
    expect(results.every((r) => r.frozenPayoutIds.length === 2)).toBe(true)
  })
})

// ── Cross-Cutting: Idempotency ────────────────────────────────────────────

describe('Cross-cutting: Idempotency', () => {
  it('admin action guard produces consistent results on retry', () => {
    const request = {
      action: 'freeze_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: 'Dispute investigation repeat attempt',
      context: makeContext({ actorRole: 'admin' }),
    }
    const r1 = executeAdminAction(request)
    const r2 = executeAdminAction(request)
    expect(r1.allowed).toBe(r2.allowed)
    expect(r1.executed).toBe(r2.executed)
    // Both produce audit events (not idempotent at the event level, but decision is)
    expect(r1.auditEventId).toBeTruthy()
    expect(r2.auditEventId).toBeTruthy()
    expect(r1.auditEventId).not.toBe(r2.auditEventId) // unique events per call
  })

  it('reconciliation converges: same data same discrepancies', () => {
    const accounts = [
      { accountId: nextId('acc'), recordedBalance: 1000, computedBalance: 995 },
      { accountId: nextId('acc'), recordedBalance: 500, computedBalance: 500 },
    ]
    const r1 = reconcileAccounts(accounts)
    const r2 = reconcileAccounts(accounts)
    expect(r1.discrepancies.length).toBe(r2.discrepancies.length)
    expect(r1.reconciled).toBe(r2.reconciled)
  })

  it('dispute freeze resolution is consistent for same inputs', () => {
    const ctx = makeContext()
    const frozenPayouts = [nextId('po')]
    const r1 = resolveDisputeFreeze(ctx, nextId('d'), 'dismissed', frozenPayouts, [])
    const ctx2 = makeContext()
    const r2 = resolveDisputeFreeze(ctx2, nextId('d'), 'dismissed', frozenPayouts, [])
    expect(r1.unfrozenPayoutIds).toEqual(r2.unfrozenPayoutIds)
    expect(r1.requiresPayoutAdjustment).toBe(r2.requiresPayoutAdjustment)
  })
})

// ── Cross-Cutting: Audit Completeness ─────────────────────────────────────

describe('Cross-cutting: Audit completeness — every critical path emits events', () => {
  beforeEach(() => {
    clearEventLog()
    clearMetrics()
  })

  it('governance violation emits POLICY_VIOLATION_DETECTED event', () => {
    const ctx = makeContext()
    validateGovernancePolicy(ctx, 'payout', {
      id: nextId('payout'),
      amount: 0.01,
    })
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.POLICY_VIOLATION_DETECTED)).toBe(true)
  })

  it('admin action (allowed) emits ADMIN_ACTION_EXECUTED', () => {
    executeAdminAction({
      action: 'test',
      targetEntityId: nextId('e'),
      targetEntityType: 'entity',
      reason: 'Audit completeness test action',
      context: makeContext({ actorRole: 'admin' }),
    })
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.ADMIN_ACTION_EXECUTED)).toBe(true)
  })

  it('admin action (denied) emits ADMIN_ACTION_EXECUTED with denied payload', () => {
    executeAdminAction({
      action: 'test',
      targetEntityId: nextId('e'),
      targetEntityType: 'entity',
      reason: 'Denied role audit test action',
      context: makeContext({ actorRole: 'viewer' }),
    })
    const events = getEventLog()
    const adminEvents = events.filter((e) => e.type === SystemEventType.ADMIN_ACTION_EXECUTED)
    expect(adminEvents.length).toBeGreaterThanOrEqual(1)
    expect(adminEvents.some((e) => e.payload['denied'] === true)).toBe(true)
  })

  it('dispute impact emits RIGHTS_DISPUTE_FILED event', () => {
    const ctx = makeContext()
    const dispute = makeDispute()
    resolveDisputeImpact(ctx, dispute, [], [])
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.RIGHTS_DISPUTE_FILED)).toBe(true)
  })

  it('dispute with frozen payouts emits PAYOUT_FROZEN event', () => {
    const ctx = makeContext()
    const payoutIds = [nextId('po')]
    const dispute = makeDispute({ relatedPayoutIds: payoutIds })
    resolveDisputeImpact(ctx, dispute, [
      { payoutId: payoutIds[0]!, amount: 100, creatorId: dispute.targetCreatorId },
    ], [])
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.PAYOUT_FROZEN)).toBe(true)
  })

  it('dispute resolution emits PAYOUT_UNFROZEN and RIGHTS_DISPUTE_RESOLVED', () => {
    const ctx = makeContext()
    resolveDisputeFreeze(ctx, nextId('d'), 'dismissed', [nextId('po')], [])
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.PAYOUT_UNFROZEN)).toBe(true)
    expect(events.some((e) => e.type === SystemEventType.RIGHTS_DISPUTE_RESOLVED)).toBe(true)
  })

  it('flagged fraud check emits FRAUD_SIGNAL_DETECTED event', () => {
    const ctx = makeContext()
    runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals: [
        { type: 'velocity', value: 30, threshold: 10, description: 'high velocity' },
        { type: 'geographic', value: 20, threshold: 5, description: 'geo anomaly' },
      ],
    })
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.FRAUD_SIGNAL_DETECTED)).toBe(true)
  })

  it('AI inference (enabled) emits AI_INFERENCE_COMPLETED event', () => {
    const ctx = makeContext()
    setFeatureFlag(AIFeatureFlag.CREATOR_INSIGHTS, true)
    executeControlledInference(ctx, {
      modelId: 'test-model',
      featureFlag: AIFeatureFlag.CREATOR_INSIGHTS,
      input: { test: true },
      requestedBy: ctx.actorId,
    }, () => ({
      result: { insight: 'test' },
      explanation: 'Test inference',
      confidence: 0.9,
    }))
    const events = getEventLog()
    expect(events.some((e) => e.type === SystemEventType.AI_INFERENCE_COMPLETED)).toBe(true)
  })
})

// ── Cross-Cutting: Observability Coverage ─────────────────────────────────

describe('Cross-cutting: Observability coverage', () => {
  beforeEach(() => {
    clearMetrics()
  })

  it('flagged fraud records FRAUD_SIGNALS_DETECTED metric', () => {
    const ctx = makeContext()
    runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals: [
        { type: 'velocity', value: 40, threshold: 10, description: 'test' },
        { type: 'geographic', value: 20, threshold: 5, description: 'test' },
      ],
    })
    const metrics = getMetrics(MetricName.FRAUD_SIGNALS_DETECTED)
    expect(metrics.length).toBeGreaterThanOrEqual(1)
  })

  it('AI inference records latency and total metrics', () => {
    const ctx = makeContext()
    setFeatureFlag(AIFeatureFlag.CONTENT_MODERATION, true)
    executeControlledInference(ctx, {
      modelId: 'mod-model',
      featureFlag: AIFeatureFlag.CONTENT_MODERATION,
      input: { text: 'test' },
      requestedBy: ctx.actorId,
    }, () => ({
      result: { safe: true },
      explanation: 'Content moderation',
      confidence: 0.95,
    }))
    const latencyMetrics = getMetrics(MetricName.AI_INFERENCE_LATENCY_MS)
    const totalMetrics = getMetrics(MetricName.AI_INFERENCE_TOTAL)
    expect(latencyMetrics.length).toBeGreaterThanOrEqual(1)
    expect(totalMetrics.length).toBeGreaterThanOrEqual(1)
  })

  it('MetricName has at least 20 metric definitions', () => {
    expect(Object.keys(MetricName).length).toBeGreaterThanOrEqual(20)
  })

  it('all metric names follow zonga.* naming convention', () => {
    for (const name of Object.values(MetricName)) {
      expect(name).toMatch(/^zonga\./)
    }
  })
})

// ── Cross-Cutting: Module Integration ─────────────────────────────────────

describe('Cross-cutting: Module integration — policy + enforcer + invariant', () => {
  it('economic enforcer + invariant checker agree on balanced ledger', () => {
    const entries = [
      makeLedgerEntry({ direction: 'credit', amount: 1000 }),
      makeLedgerEntry({ direction: 'debit', amount: 1000 }),
    ]
    const ledgerResult = validateLedgerIntegrity(entries)
    expect(ledgerResult.valid).toBe(true)

    const ctx = makeContext()
    const invariantInput: InvariantInput = {
      ledgerDebits: 1000,
      ledgerCredits: 1000,
    }
    const invariantResult = checkAllInvariants(ctx, invariantInput)
    const ledgerViolation = invariantResult.failures.find(
      (v) => v.id === InvariantId.LEDGER_BALANCED,
    )
    expect(ledgerViolation).toBeUndefined()
  })

  it('economic enforcer + invariant checker agree on imbalanced ledger', () => {
    const entries = [
      makeLedgerEntry({ direction: 'credit', amount: 1000 }),
      makeLedgerEntry({ direction: 'debit', amount: 900 }),
    ]
    const ledgerResult = validateLedgerIntegrity(entries)
    expect(ledgerResult.valid).toBe(false)

    const ctx = makeContext()
    const invariantInput: InvariantInput = {
      ledgerDebits: 900,
      ledgerCredits: 1000,
    }
    const invariantResult = checkAllInvariants(ctx, invariantInput)
    const ledgerViolation = invariantResult.failures.find(
      (v) => v.id === InvariantId.LEDGER_BALANCED,
    )
    expect(ledgerViolation).toBeDefined()
  })

  it('governance blocks disputed payout AND canExecutePayout blocks it', () => {
    const ctx = makeContext()
    const govResult = validateGovernancePolicy(ctx, 'payout', {
      id: nextId('payout'),
      amount: 100,
      hasActiveDispute: true,
    })
    expect(govResult.passed).toBe(false)

    // canExecutePayout: positional args (payoutAmount, availableBalance, hasDispute, hasLedgerBacking)
    const payoutResult = canExecutePayout(100, 1000, true, true)
    expect(payoutResult.allowed).toBe(false)
    expect(payoutResult.reasons.some((r) => r.toLowerCase().includes('dispute'))).toBe(true)
  })

  it('dispute impact freeze → governance blocks payout → unfreeze allows', () => {
    const ctx = makeContext()
    const payoutIds = [nextId('po')]
    const dispute = makeDispute({ relatedPayoutIds: payoutIds })

    // Step 1: Freeze payout via dispute
    const impact = resolveDisputeImpact(ctx, dispute, [
      { payoutId: payoutIds[0]!, amount: 500, creatorId: dispute.targetCreatorId },
    ], [])
    expect(impact.frozenPayoutIds).toEqual(payoutIds)

    // Step 2: Governance blocks payout (active dispute)
    const govResult = validateGovernancePolicy(ctx, 'payout', {
      id: payoutIds[0],
      amount: 500,
      hasActiveDispute: true,
    })
    expect(govResult.passed).toBe(false)

    // Step 3: Resolve dispute → unfreeze
    const resolution = resolveDisputeFreeze(
      ctx, dispute.id, 'dismissed', impact.frozenPayoutIds, [],
    )
    expect(resolution.unfrozenPayoutIds).toEqual(payoutIds)

    // Step 4: After resolution — governance passes (no active dispute)
    const govResult2 = validateGovernancePolicy(ctx, 'payout', {
      id: payoutIds[0],
      amount: 500,
      hasActiveDispute: false,
    })
    expect(govResult2.passed).toBe(true)
  })

  it('all WorkflowId values are enumerable', () => {
    const ids = Object.values(WorkflowId)
    expect(ids.length).toBe(12)
    expect(new Set(ids).size).toBe(12)
  })

  it('all InvariantId values are enumerable', () => {
    const ids = Object.values(InvariantId)
    expect(ids.length).toBe(9)
    expect(new Set(ids).size).toBe(9)
  })

  it('all AuditSeverity levels exist', () => {
    expect(AuditSeverity.INFO).toBe('info')
    expect(AuditSeverity.WARNING).toBe('warning')
    expect(AuditSeverity.ERROR).toBe('error')
    expect(AuditSeverity.CRITICAL).toBe('critical')
  })

  it('stress: 500 invariant checks + governance validations combined', () => {
    const ctx = makeContext()
    for (let i = 0; i < 500; i++) {
      const input = makeValidInvariantInput()
      const result = checkAllInvariants(ctx, input)
      expect(result.allPassed).toBe(true)

      const govResult = validateGovernancePolicy(ctx, 'payout', {
        id: nextId('payout'),
        amount: 50,
        hasActiveDispute: false,
      })
      expect(govResult.passed).toBe(true)
    }
  })
})
