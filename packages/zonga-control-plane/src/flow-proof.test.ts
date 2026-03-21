/**
 * @nzila/zonga-control-plane — Flow / Control Plane Operational Proof Suite
 *
 * Covers FLW-1 through FLW-5 from PROOF_TARGET_MATRIX.md:
 *   FLW-1: Workflow exclusivity — duplicate registration rejected
 *   FLW-2: No orphan states (structural — covered here + workflow-invariants.test.ts)
 *   FLW-3: Terminal states are sinks (structural — covered here + workflow-invariants.test.ts)
 *   FLW-4: Invariant checker completeness — all 9 invariant IDs exercised
 *   FLW-5: Compensation correctness — rollback reverses side effects
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerWorkflow,
  getWorkflowDefinition,
  listRegisteredWorkflows,
  executeWorkflow,
  WorkflowNotFoundError,
} from './orchestrator'
import {
  checkAllInvariants,
} from './invariant-checker'
import type { InvariantInput } from './invariant-checker'
import {
  validateLedgerIntegrity,
  enforceEconomicIntegrity,
  canExecutePayout,
  reconcileAccounts,
} from './economic-enforcer'
import type { LedgerEntry, LedgerTransaction, PayoutRecord, RevenueRecord } from './economic-enforcer'
import {
  WorkflowId,
  WorkflowStepStatus,
  WorkflowExecutionStatus,
  InvariantId,
} from './types'
import type {
  ControlPlaneContext,
  WorkflowDefinition,
  WorkflowStepResult,
} from './types'

// ── Helpers ───────────────────────────────────────────────────────────────

let _id = 0
function nextId(): string { return `flow-proof-${++_id}` }

function makeContext(overrides: Partial<ControlPlaneContext> = {}): ControlPlaneContext {
  return {
    orgId: 'org-proof',
    actorId: 'actor-proof',
    actorRole: 'admin',
    correlationId: nextId(),
    requestId: nextId(),
    timestamp: new Date(),
    ...overrides,
  }
}

function makeWorkflowDef(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: `test_wf_${nextId()}` as any,
    name: 'Test Workflow',
    description: 'A test workflow',
    steps: [
      {
        id: 'step-1',
        name: 'Step 1',
        execute: async () => ({ success: true, output: { done: true } }),
        maxRetries: 0,
        timeoutMs: 5000,
      },
    ],
    maxRetries: 0,
    timeoutMs: 30000,
    ...overrides,
  }
}

function makeLedgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: nextId(),
    transactionId: 'tx-1',
    accountId: 'acc-1',
    direction: 'debit',
    amount: 100,
    currency: 'USD',
    createdAt: new Date(),
    ...overrides,
  }
}

// ── FLW-1: Workflow Exclusivity ───────────────────────────────────────

describe('FLW-1: Workflow exclusivity — duplicate registration rejected', () => {
  // NOTE: The workflowRegistry is module-scoped. We create unique IDs per test.

  it('registers a workflow successfully', () => {
    const def = makeWorkflowDef()
    registerWorkflow(def)
    expect(getWorkflowDefinition(def.id)).toBeDefined()
    expect(getWorkflowDefinition(def.id)?.name).toBe('Test Workflow')
  })

  it('rejects duplicate workflow registration', () => {
    const def = makeWorkflowDef()
    registerWorkflow(def)
    expect(() => registerWorkflow(def)).toThrow(`Workflow ${def.id} is already registered`)
  })

  it('different IDs register independently', () => {
    const def1 = makeWorkflowDef()
    const def2 = makeWorkflowDef()
    registerWorkflow(def1)
    registerWorkflow(def2)
    expect(getWorkflowDefinition(def1.id)).toBeDefined()
    expect(getWorkflowDefinition(def2.id)).toBeDefined()
    expect(def1.id).not.toBe(def2.id)
  })

  it('listRegisteredWorkflows includes all registered', () => {
    const before = listRegisteredWorkflows().length
    const def = makeWorkflowDef()
    registerWorkflow(def)
    const after = listRegisteredWorkflows().length
    expect(after).toBe(before + 1)
  })

  it('executing unregistered workflow throws WorkflowNotFoundError', async () => {
    const ctx = makeContext()
    await expect(executeWorkflow('nonexistent-wf' as any, ctx, {}))
      .rejects.toThrow(WorkflowNotFoundError)
  })
})

// ── FLW-2 & FLW-3: Structural (supplementary to workflow-invariants.test.ts) ──

describe('FLW-2/3: Workflow ID enum completeness', () => {
  it('all 12 WorkflowIds are defined', () => {
    const ids = Object.values(WorkflowId)
    expect(ids).toHaveLength(12)
    expect(ids).toContain('artist_onboarding_flow')
    expect(ids).toContain('release_publish_flow')
    expect(ids).toContain('track_upload_processing_flow')
    expect(ids).toContain('event_creation_flow')
    expect(ids).toContain('ticket_purchase_flow')
    expect(ids).toContain('ticket_scan_flow')
    expect(ids).toContain('refund_flow')
    expect(ids).toContain('payout_settlement_flow')
    expect(ids).toContain('rights_update_flow')
    expect(ids).toContain('dispute_resolution_flow')
    expect(ids).toContain('moderation_flow')
    expect(ids).toContain('payment_failure_recovery_flow')
  })

  it('WorkflowStepStatus covers full lifecycle', () => {
    const statuses = Object.values(WorkflowStepStatus)
    expect(statuses).toContain('pending')
    expect(statuses).toContain('running')
    expect(statuses).toContain('completed')
    expect(statuses).toContain('failed')
    expect(statuses).toContain('compensated')
    expect(statuses).toContain('skipped')
  })

  it('WorkflowExecutionStatus covers full lifecycle', () => {
    const statuses = Object.values(WorkflowExecutionStatus)
    expect(statuses).toContain('created')
    expect(statuses).toContain('running')
    expect(statuses).toContain('completed')
    expect(statuses).toContain('failed')
    expect(statuses).toContain('compensated')
    expect(statuses).toContain('timed_out')
  })
})

// ── FLW-4: Invariant Checker Completeness ─────────────────────────────

describe('FLW-4: Invariant checker completeness', () => {
  const ctx = makeContext()

  it('all 9 InvariantIds are defined', () => {
    const ids = Object.values(InvariantId)
    expect(ids).toHaveLength(9)
    expect(ids).toContain('invariant.no_revenue_without_ledger')
    expect(ids).toContain('invariant.no_payout_without_backing')
    expect(ids).toContain('invariant.no_event_oversell')
    expect(ids).toContain('invariant.no_invalid_rights_split')
    expect(ids).toContain('invariant.no_auditless_action')
    expect(ids).toContain('invariant.no_workflow_bypass')
    expect(ids).toContain('invariant.ledger_balanced')
    expect(ids).toContain('invariant.no_negative_payout')
    expect(ids).toContain('invariant.splits_sum_100')
  })

  it('checkAllInvariants passes with all-valid input', () => {
    const input: InvariantInput = {
      revenueRecords: [{ id: 'r1', hasLedgerEntry: true }],
      payoutRecords: [{ id: 'p1', hasLedgerBacking: true, amount: 100 }],
      eventRecords: [{ id: 'e1', capacity: 100, ticketsSold: 50 }],
      splitRecords: [{ releaseId: 'rel1', splitTotal: 100 }],
      actionRecords: [{ actionId: 'a1', hasAuditEvent: true }],
      workflowRecords: [{ operationId: 'op1', executedViaWorkflow: true }],
      ledgerDebits: 1000,
      ledgerCredits: 1000,
    }
    const result = checkAllInvariants(ctx, input)
    expect(result.allPassed).toBe(true)
    expect(result.failures).toHaveLength(0)
  })

  it('detects revenue without ledger entry', () => {
    const result = checkAllInvariants(ctx, {
      revenueRecords: [
        { id: 'r1', hasLedgerEntry: true },
        { id: 'r2', hasLedgerEntry: false },
      ],
    })
    const check = result.checks.find(c => c.id === InvariantId.NO_REVENUE_WITHOUT_LEDGER)
    expect(check?.passed).toBe(false)
    expect(check?.details).toContain('r2')
  })

  it('detects payout without ledger backing', () => {
    const result = checkAllInvariants(ctx, {
      payoutRecords: [{ id: 'p1', hasLedgerBacking: false, amount: 100 }],
    })
    const check = result.checks.find(c => c.id === InvariantId.NO_PAYOUT_WITHOUT_BACKING)
    expect(check?.passed).toBe(false)
  })

  it('detects negative payouts', () => {
    const result = checkAllInvariants(ctx, {
      payoutRecords: [{ id: 'p1', hasLedgerBacking: true, amount: -50 }],
    })
    const check = result.checks.find(c => c.id === InvariantId.NO_NEGATIVE_PAYOUT)
    expect(check?.passed).toBe(false)
  })

  it('detects event oversell', () => {
    const result = checkAllInvariants(ctx, {
      eventRecords: [{ id: 'e1', capacity: 100, ticketsSold: 105 }],
    })
    const check = result.checks.find(c => c.id === InvariantId.NO_EVENT_OVERSELL)
    expect(check?.passed).toBe(false)
    expect(check?.details).toContain('105/100')
  })

  it('detects invalid rights split (!=100%)', () => {
    const result = checkAllInvariants(ctx, {
      splitRecords: [{ releaseId: 'rel1', splitTotal: 95 }],
    })
    const splitCheck = result.checks.find(c => c.id === InvariantId.NO_INVALID_RIGHTS_SPLIT)
    const sumCheck = result.checks.find(c => c.id === InvariantId.SPLITS_SUM_100)
    expect(splitCheck?.passed).toBe(false)
    expect(sumCheck?.passed).toBe(false)
  })

  it('detects auditless actions', () => {
    const result = checkAllInvariants(ctx, {
      actionRecords: [{ actionId: 'a1', hasAuditEvent: false }],
    })
    const check = result.checks.find(c => c.id === InvariantId.NO_AUDITLESS_ACTION)
    expect(check?.passed).toBe(false)
  })

  it('detects workflow bypass', () => {
    const result = checkAllInvariants(ctx, {
      workflowRecords: [{ operationId: 'op1', executedViaWorkflow: false }],
    })
    const check = result.checks.find(c => c.id === InvariantId.NO_WORKFLOW_BYPASS)
    expect(check?.passed).toBe(false)
  })

  it('detects ledger imbalance', () => {
    const result = checkAllInvariants(ctx, {
      ledgerDebits: 1000,
      ledgerCredits: 999,
    })
    const check = result.checks.find(c => c.id === InvariantId.LEDGER_BALANCED)
    expect(check?.passed).toBe(false)
    expect(check?.details).toContain('discrepancy')
  })

  it('ledger passes within 0.001 tolerance', () => {
    const result = checkAllInvariants(ctx, {
      ledgerDebits: 1000,
      ledgerCredits: 999.9999,
    })
    const check = result.checks.find(c => c.id === InvariantId.LEDGER_BALANCED)
    expect(check?.passed).toBe(true)
  })

  it('empty input produces no checks (no false failures)', () => {
    const result = checkAllInvariants(ctx, {})
    expect(result.allPassed).toBe(true)
    expect(result.checks).toHaveLength(0)
  })

  it('multiple simultaneous violations all reported', () => {
    const result = checkAllInvariants(ctx, {
      revenueRecords: [{ id: 'r1', hasLedgerEntry: false }],
      payoutRecords: [{ id: 'p1', hasLedgerBacking: false, amount: -10 }],
      eventRecords: [{ id: 'e1', capacity: 10, ticketsSold: 20 }],
      splitRecords: [{ releaseId: 'rel1', splitTotal: 80 }],
      actionRecords: [{ actionId: 'a1', hasAuditEvent: false }],
      workflowRecords: [{ operationId: 'op1', executedViaWorkflow: false }],
      ledgerDebits: 100,
      ledgerCredits: 200,
    })
    expect(result.allPassed).toBe(false)
    // At least one failure per category
    expect(result.failures.length).toBeGreaterThanOrEqual(7)
  })
})

// ── FLW-5: Compensation Correctness ──────────────────────────────────

describe('FLW-5: Compensation correctness — rollback reverses side effects', () => {
  it('successful workflow completes all steps', async () => {
    const stepLog: string[] = []
    const def = makeWorkflowDef({
      steps: [
        {
          id: 'step-1', name: 'First', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-1'); return { success: true, output: { v: 1 } } },
          compensate: async () => { stepLog.push('comp-1') },
        },
        {
          id: 'step-2', name: 'Second', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-2'); return { success: true, output: { v: 2 } } },
          compensate: async () => { stepLog.push('comp-2') },
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPLETED)
    expect(stepLog).toEqual(['exec-1', 'exec-2'])
    // No compensation was triggered
    expect(stepLog).not.toContain('comp-1')
    expect(stepLog).not.toContain('comp-2')
  })

  it('failed step triggers compensation in reverse order', async () => {
    const stepLog: string[] = []
    const def = makeWorkflowDef({
      steps: [
        {
          id: 's1', name: 'Step 1', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-1'); return { success: true } },
          compensate: async () => { stepLog.push('comp-1') },
        },
        {
          id: 's2', name: 'Step 2', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-2'); return { success: true } },
          compensate: async () => { stepLog.push('comp-2') },
        },
        {
          id: 's3', name: 'Step 3 (fails)', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-3'); return { success: false, error: 'boom' } },
          compensate: async () => { stepLog.push('comp-3') },
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPENSATED)
    expect(result.error).toBe('boom')
    // exec-1, exec-2, exec-3 (fails), then comp-2, comp-1 (reverse order)
    expect(stepLog).toEqual(['exec-1', 'exec-2', 'exec-3', 'comp-2', 'comp-1'])
  })

  it('compensation runs even when some steps lack compensate handler', async () => {
    const stepLog: string[] = []
    const def = makeWorkflowDef({
      steps: [
        {
          id: 's1', name: 'Step 1 (no compensate)', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-1'); return { success: true } },
          // NO compensate handler
        },
        {
          id: 's2', name: 'Step 2', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-2'); return { success: true } },
          compensate: async () => { stepLog.push('comp-2') },
        },
        {
          id: 's3', name: 'Fails', maxRetries: 0, timeoutMs: 5000,
          execute: async () => ({ success: false, error: 'fail' }),
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPENSATED)
    // comp-2 runs, step 1 is skipped (no handler)
    expect(stepLog).toContain('comp-2')
    const s1Status = result.steps.find(s => s.id === 's1')
    expect(s1Status?.status).toBe(WorkflowStepStatus.SKIPPED)
  })

  it('retry logic exhausts maxRetries before failing', async () => {
    let attempts = 0
    const def = makeWorkflowDef({
      steps: [
        {
          id: 's1', name: 'Retryable', maxRetries: 2, timeoutMs: 5000,
          execute: async () => {
            attempts++
            return { success: false, error: `attempt ${attempts}`, shouldRetry: true }
          },
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPENSATED)
    expect(attempts).toBe(3) // 1 initial + 2 retries
  })

  it('step that succeeds on retry completes workflow', async () => {
    let attempts = 0
    const def = makeWorkflowDef({
      steps: [
        {
          id: 's1', name: 'Flaky', maxRetries: 3, timeoutMs: 5000,
          execute: async () => {
            attempts++
            if (attempts < 3) return { success: false, error: 'flaky', shouldRetry: true }
            return { success: true, output: { recovered: true } }
          },
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPLETED)
    expect(attempts).toBe(3)
  })

  it('first step failure means no compensation needed', async () => {
    const stepLog: string[] = []
    const def = makeWorkflowDef({
      steps: [
        {
          id: 's1', name: 'Fails immediately', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-1'); return { success: false, error: 'instant fail' } },
          compensate: async () => { stepLog.push('comp-1') },
        },
        {
          id: 's2', name: 'Never reached', maxRetries: 0, timeoutMs: 5000,
          execute: async () => { stepLog.push('exec-2'); return { success: true } },
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPENSATED)
    // Only exec-1 runs; no compensation needed since first step failed
    expect(stepLog).toEqual(['exec-1'])
  })

  it('step output flows between steps', async () => {
    const def = makeWorkflowDef({
      steps: [
        {
          id: 's1', name: 'Producer', maxRetries: 0, timeoutMs: 5000,
          execute: async () => ({ success: true, output: { amount: 500 } }),
        },
        {
          id: 's2', name: 'Consumer', maxRetries: 0, timeoutMs: 5000,
          execute: async (_ctx, _input, prev) => {
            expect(prev).toEqual({ amount: 500 })
            return { success: true, output: { doubled: 1000 } }
          },
        },
      ],
    })
    registerWorkflow(def)

    const result = await executeWorkflow(def.id, makeContext(), {})
    expect(result.status).toBe(WorkflowExecutionStatus.COMPLETED)
    expect(result.output).toEqual({ doubled: 1000 })
  })
})

// ── Economic Enforcer Integration ─────────────────────────────────────

describe('FLW-5 (extended): Economic enforcer integration', () => {
  it('validateLedgerIntegrity passes balanced entries', () => {
    const entries = [
      makeLedgerEntry({ direction: 'debit', amount: 100 }),
      makeLedgerEntry({ direction: 'credit', amount: 100 }),
    ]
    const result = validateLedgerIntegrity(entries)
    expect(result.valid).toBe(true)
    expect(result.totalDebits).toBe(100)
    expect(result.totalCredits).toBe(100)
  })

  it('validateLedgerIntegrity rejects single entry', () => {
    const entries = [makeLedgerEntry()]
    const result = validateLedgerIntegrity(entries)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at least 2'))).toBe(true)
  })

  it('validateLedgerIntegrity rejects imbalanced entries', () => {
    const entries = [
      makeLedgerEntry({ direction: 'debit', amount: 100 }),
      makeLedgerEntry({ direction: 'credit', amount: 95 }),
    ]
    const result = validateLedgerIntegrity(entries)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('imbalance'))).toBe(true)
  })

  it('validateLedgerIntegrity rejects non-positive amounts', () => {
    const entries = [
      makeLedgerEntry({ direction: 'debit', amount: 0 }),
      makeLedgerEntry({ direction: 'credit', amount: 0 }),
    ]
    const result = validateLedgerIntegrity(entries)
    expect(result.valid).toBe(false)
  })

  it('enforceEconomicIntegrity detects unbacked payouts', () => {
    const ctx = makeContext()
    const txs: LedgerTransaction[] = [{
      id: 'tx1', entries: [
        makeLedgerEntry({ transactionId: 'tx1', direction: 'debit', amount: 50 }),
        makeLedgerEntry({ transactionId: 'tx1', direction: 'credit', amount: 50 }),
      ], status: 'posted', correlationId: 'c1', createdAt: new Date(),
    }]
    const payouts: PayoutRecord[] = [
      { id: 'p1', creatorId: 'c1', amount: 100, currency: 'USD', status: 'pending' },
    ]
    const result = enforceEconomicIntegrity(ctx, txs, payouts, [])
    expect(result.payoutsWithoutBacking).toContain('p1')
  })

  it('enforceEconomicIntegrity detects revenue without ledger', () => {
    const ctx = makeContext()
    const revenues: RevenueRecord[] = [
      { id: 'rev1', type: 'ticket_sale', amount: 100, currency: 'USD' },
    ]
    const result = enforceEconomicIntegrity(ctx, [], [], revenues)
    expect(result.revenueWithoutLedger).toContain('rev1')
  })

  it('canExecutePayout blocks disputed payouts', () => {
    const result = canExecutePayout(100, 500, true, true)
    expect(result.allowed).toBe(false)
    expect(result.reasons.some(r => r.includes('dispute'))).toBe(true)
  })

  it('canExecutePayout blocks unbacked payouts', () => {
    const result = canExecutePayout(100, 500, false, false)
    expect(result.allowed).toBe(false)
    expect(result.reasons.some(r => r.includes('ledger backing'))).toBe(true)
  })

  it('canExecutePayout blocks insufficient balance', () => {
    const result = canExecutePayout(600, 500, false, true)
    expect(result.allowed).toBe(false)
    expect(result.reasons.some(r => r.includes('exceeds'))).toBe(true)
  })

  it('canExecutePayout allows valid payout', () => {
    const result = canExecutePayout(100, 500, false, true)
    expect(result.allowed).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('reconcileAccounts detects discrepancies', () => {
    const accounts = [
      { accountId: 'a1', recordedBalance: 1000, computedBalance: 995 },
      { accountId: 'a2', recordedBalance: 500, computedBalance: 500 },
    ]
    const result = reconcileAccounts(accounts)
    expect(result.reconciled).toBe(false)
    expect(result.discrepancies).toHaveLength(1)
    expect(result.discrepancies[0]!.accountId).toBe('a1')
    expect(result.discrepancies[0]!.variance).toBe(5)
  })

  it('reconcileAccounts passes within 0.001 tolerance', () => {
    const accounts = [
      { accountId: 'a1', recordedBalance: 1000, computedBalance: 999.9999 },
    ]
    const result = reconcileAccounts(accounts)
    expect(result.reconciled).toBe(true)
  })

  it('stress: 1000 transactions all balanced', () => {
    const ctx = makeContext()
    const txs: LedgerTransaction[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `tx-${i}`,
      entries: [
        makeLedgerEntry({ transactionId: `tx-${i}`, direction: 'debit' as const, amount: 100 + i }),
        makeLedgerEntry({ transactionId: `tx-${i}`, direction: 'credit' as const, amount: 100 + i }),
      ],
      status: 'posted' as const,
      correlationId: `corr-${i}`,
      createdAt: new Date(),
    }))
    const result = enforceEconomicIntegrity(ctx, txs, [], [])
    expect(result.ledgerBalanced).toBe(true)
    expect(result.unreconciledTransactions).toHaveLength(0)
  })
})
