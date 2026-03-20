/**
 * @nzila/zonga-control-plane — Invariant Checker Tests
 *
 * Tests every system invariant to ensure the control plane
 * rejects any state that violates platform correctness.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { checkAllInvariants, checkInvariant } from './invariant-checker'
import type { ControlPlaneContext, InvariantCheck } from './types'
import { InvariantId } from './types'
import { clearEventLog } from './system-events'

function makeContext(overrides?: Partial<ControlPlaneContext>): ControlPlaneContext {
  return {
    orgId: 'org-test',
    actorId: 'actor-test',
    actorRole: 'admin',
    correlationId: 'corr-test',
    requestId: 'req-test',
    timestamp: new Date(),
    ...overrides,
  }
}

describe('@nzila/zonga-control-plane — invariant checker', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── Revenue × Ledger ──────────────────────────────────────────────────

  describe('NO_REVENUE_WITHOUT_LEDGER', () => {
    it('passes when every revenue has a ledger entry', () => {
      const result = checkAllInvariants(makeContext(), {
        revenueRecords: [
          { id: 'rev-1', hasLedgerEntry: true },
          { id: 'rev-2', hasLedgerEntry: true },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_REVENUE_WITHOUT_LEDGER)!
      expect(check.passed).toBe(true)
    })

    it('fails when revenue lacks ledger entry', () => {
      const result = checkAllInvariants(makeContext(), {
        revenueRecords: [
          { id: 'rev-1', hasLedgerEntry: true },
          { id: 'rev-orphan', hasLedgerEntry: false },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_REVENUE_WITHOUT_LEDGER)!
      expect(check.passed).toBe(false)
      expect(check.details).toContain('rev-orphan')
      expect(result.allPassed).toBe(false)
    })
  })

  // ── Payout Backing ────────────────────────────────────────────────────

  describe('NO_PAYOUT_WITHOUT_BACKING', () => {
    it('passes when all payouts have ledger backing', () => {
      const result = checkAllInvariants(makeContext(), {
        payoutRecords: [
          { id: 'p-1', hasLedgerBacking: true, amount: 100 },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_PAYOUT_WITHOUT_BACKING)!
      expect(check.passed).toBe(true)
    })

    it('fails when payout has no ledger backing', () => {
      const result = checkAllInvariants(makeContext(), {
        payoutRecords: [
          { id: 'p-unbacked', hasLedgerBacking: false, amount: 500 },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_PAYOUT_WITHOUT_BACKING)!
      expect(check.passed).toBe(false)
      expect(check.details).toContain('p-unbacked')
    })
  })

  // ── Negative Payouts ──────────────────────────────────────────────────

  describe('NO_NEGATIVE_PAYOUT', () => {
    it('passes with positive payout amounts', () => {
      const result = checkAllInvariants(makeContext(), {
        payoutRecords: [
          { id: 'p-1', hasLedgerBacking: true, amount: 100 },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_NEGATIVE_PAYOUT)!
      expect(check.passed).toBe(true)
    })

    it('fails with negative payout amount', () => {
      const result = checkAllInvariants(makeContext(), {
        payoutRecords: [
          { id: 'p-neg', hasLedgerBacking: true, amount: -50 },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_NEGATIVE_PAYOUT)!
      expect(check.passed).toBe(false)
      expect(check.details).toContain('p-neg')
    })
  })

  // ── Event Oversell ────────────────────────────────────────────────────

  describe('NO_EVENT_OVERSELL', () => {
    it('passes when tickets sold ≤ capacity', () => {
      const result = checkAllInvariants(makeContext(), {
        eventRecords: [
          { id: 'evt-1', capacity: 500, ticketsSold: 500 },
          { id: 'evt-2', capacity: 1000, ticketsSold: 42 },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_EVENT_OVERSELL)!
      expect(check.passed).toBe(true)
    })

    it('fails when tickets sold > capacity', () => {
      const result = checkAllInvariants(makeContext(), {
        eventRecords: [
          { id: 'evt-oversold', capacity: 100, ticketsSold: 101 },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_EVENT_OVERSELL)!
      expect(check.passed).toBe(false)
      expect(check.details).toContain('evt-oversold')
      expect(check.details).toContain('101/100')
    })
  })

  // ── Rights Splits ─────────────────────────────────────────────────────

  describe('NO_INVALID_RIGHTS_SPLIT / SPLITS_SUM_100', () => {
    it('passes when splits sum to 100%', () => {
      const result = checkAllInvariants(makeContext(), {
        splitRecords: [
          { releaseId: 'rel-1', splitTotal: 100 },
          { releaseId: 'rel-2', splitTotal: 100 },
        ],
      })
      const splitCheck = result.checks.find(c => c.id === InvariantId.NO_INVALID_RIGHTS_SPLIT)!
      const sumCheck = result.checks.find(c => c.id === InvariantId.SPLITS_SUM_100)!
      expect(splitCheck.passed).toBe(true)
      expect(sumCheck.passed).toBe(true)
    })

    it('fails when splits do not sum to 100%', () => {
      const result = checkAllInvariants(makeContext(), {
        splitRecords: [
          { releaseId: 'rel-broken', splitTotal: 85 },
        ],
      })
      const splitCheck = result.checks.find(c => c.id === InvariantId.NO_INVALID_RIGHTS_SPLIT)!
      expect(splitCheck.passed).toBe(false)
      expect(splitCheck.details).toContain('rel-broken')
    })

    it('treats tiny floating-point differences as valid', () => {
      const result = checkAllInvariants(makeContext(), {
        splitRecords: [
          { releaseId: 'rel-fp', splitTotal: 100.0009 },
        ],
      })
      const splitCheck = result.checks.find(c => c.id === InvariantId.NO_INVALID_RIGHTS_SPLIT)!
      expect(splitCheck.passed).toBe(true)
    })
  })

  // ── Audit Trail ───────────────────────────────────────────────────────

  describe('NO_AUDITLESS_ACTION', () => {
    it('passes when every action has an audit event', () => {
      const result = checkAllInvariants(makeContext(), {
        actionRecords: [
          { actionId: 'act-1', hasAuditEvent: true },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_AUDITLESS_ACTION)!
      expect(check.passed).toBe(true)
    })

    it('fails when action lacks audit event', () => {
      const result = checkAllInvariants(makeContext(), {
        actionRecords: [
          { actionId: 'act-ghost', hasAuditEvent: false },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_AUDITLESS_ACTION)!
      expect(check.passed).toBe(false)
      expect(check.details).toContain('act-ghost')
    })
  })

  // ── Workflow Bypass ───────────────────────────────────────────────────

  describe('NO_WORKFLOW_BYPASS', () => {
    it('passes when all operations use the workflow engine', () => {
      const result = checkAllInvariants(makeContext(), {
        workflowRecords: [
          { operationId: 'op-1', executedViaWorkflow: true },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_WORKFLOW_BYPASS)!
      expect(check.passed).toBe(true)
    })

    it('fails when operation bypasses the workflow', () => {
      const result = checkAllInvariants(makeContext(), {
        workflowRecords: [
          { operationId: 'op-bypass', executedViaWorkflow: false },
        ],
      })
      const check = result.checks.find(c => c.id === InvariantId.NO_WORKFLOW_BYPASS)!
      expect(check.passed).toBe(false)
    })
  })

  // ── Ledger Balance ────────────────────────────────────────────────────

  describe('LEDGER_BALANCED', () => {
    it('passes when debits == credits', () => {
      const result = checkAllInvariants(makeContext(), {
        ledgerDebits: 5000,
        ledgerCredits: 5000,
      })
      const check = result.checks.find(c => c.id === InvariantId.LEDGER_BALANCED)!
      expect(check.passed).toBe(true)
    })

    it('fails when debits != credits', () => {
      const result = checkAllInvariants(makeContext(), {
        ledgerDebits: 5000,
        ledgerCredits: 4900,
      })
      const check = result.checks.find(c => c.id === InvariantId.LEDGER_BALANCED)!
      expect(check.passed).toBe(false)
      expect(check.details).toContain('imbalance')
    })
  })

  // ── Combined check ───────────────────────────────────────────────────

  describe('checkAllInvariants', () => {
    it('allPassed is true when every invariant holds', () => {
      const result = checkAllInvariants(makeContext(), {
        revenueRecords: [{ id: 'r1', hasLedgerEntry: true }],
        payoutRecords: [{ id: 'p1', hasLedgerBacking: true, amount: 100 }],
        eventRecords: [{ id: 'e1', capacity: 1000, ticketsSold: 50 }],
        splitRecords: [{ releaseId: 'rel1', splitTotal: 100 }],
        actionRecords: [{ actionId: 'a1', hasAuditEvent: true }],
        workflowRecords: [{ operationId: 'o1', executedViaWorkflow: true }],
        ledgerDebits: 1000,
        ledgerCredits: 1000,
      })
      expect(result.allPassed).toBe(true)
      expect(result.failures).toHaveLength(0)
    })

    it('allPassed is false when any invariant fails', () => {
      const result = checkAllInvariants(makeContext(), {
        revenueRecords: [{ id: 'r1', hasLedgerEntry: false }],
        ledgerDebits: 1000,
        ledgerCredits: 1000,
      })
      expect(result.allPassed).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })
  })

  // ── Single invariant check ───────────────────────────────────────────

  describe('checkInvariant', () => {
    it('returns the specific invariant result', () => {
      const check = checkInvariant(
        makeContext(),
        InvariantId.LEDGER_BALANCED,
        { ledgerDebits: 100, ledgerCredits: 100 },
      )
      expect(check.id).toBe(InvariantId.LEDGER_BALANCED)
      expect(check.passed).toBe(true)
    })

    it('returns failure for inapplicable invariant', () => {
      const check = checkInvariant(
        makeContext(),
        InvariantId.LEDGER_BALANCED,
        {}, // no ledger data provided
      )
      expect(check.passed).toBe(false)
      expect(check.details).toContain('not applicable')
    })
  })
})
