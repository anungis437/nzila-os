/**
 * @nzila/zonga-control-plane — Economic Enforcer Tests
 *
 * Validates double-entry ledger integrity, payout gating,
 * reconciliation, and revenue-to-ledger mapping.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateLedgerIntegrity,
  enforceEconomicIntegrity,
  reconcileAccounts,
  canExecutePayout,
  validateRevenueToLedgerMapping,
} from './economic-enforcer'
import type { ControlPlaneContext } from './types'
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

const now = new Date()

describe('@nzila/zonga-control-plane — economic enforcer', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── Ledger Integrity ──────────────────────────────────────────────────

  describe('validateLedgerIntegrity', () => {
    it('validates balanced debit/credit pairs', () => {
      const result = validateLedgerIntegrity([
        { id: 'e1', transactionId: 'tx1', accountId: 'a1', direction: 'debit', amount: 100, currency: 'USD', createdAt: now },
        { id: 'e2', transactionId: 'tx1', accountId: 'a2', direction: 'credit', amount: 100, currency: 'USD', createdAt: now },
      ])
      expect(result.valid).toBe(true)
      expect(result.totalDebits).toBe(100)
      expect(result.totalCredits).toBe(100)
    })

    it('rejects imbalanced entries', () => {
      const result = validateLedgerIntegrity([
        { id: 'e1', transactionId: 'tx1', accountId: 'a1', direction: 'debit', amount: 200, currency: 'USD', createdAt: now },
        { id: 'e2', transactionId: 'tx1', accountId: 'a2', direction: 'credit', amount: 100, currency: 'USD', createdAt: now },
      ])
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('imbalance'))).toBe(true)
    })

    it('rejects fewer than 2 entries', () => {
      const result = validateLedgerIntegrity([
        { id: 'e1', transactionId: 'tx1', accountId: 'a1', direction: 'debit', amount: 100, currency: 'USD', createdAt: now },
      ])
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Double-entry')
    })

    it('rejects zero or negative amounts', () => {
      const result = validateLedgerIntegrity([
        { id: 'e1', transactionId: 'tx1', accountId: 'a1', direction: 'debit', amount: 0, currency: 'USD', createdAt: now },
        { id: 'e2', transactionId: 'tx1', accountId: 'a2', direction: 'credit', amount: 0, currency: 'USD', createdAt: now },
      ])
      expect(result.valid).toBe(false)
    })

    it('handles complex multi-entry transactions', () => {
      const result = validateLedgerIntegrity([
        { id: 'e1', transactionId: 'tx1', accountId: 'a1', direction: 'debit', amount: 100, currency: 'USD', createdAt: now },
        { id: 'e2', transactionId: 'tx1', accountId: 'a2', direction: 'credit', amount: 70, currency: 'USD', createdAt: now },
        { id: 'e3', transactionId: 'tx1', accountId: 'a3', direction: 'credit', amount: 30, currency: 'USD', createdAt: now },
      ])
      expect(result.valid).toBe(true)
      expect(result.totalDebits).toBe(100)
      expect(result.totalCredits).toBe(100)
    })
  })

  // ── Economic Integrity Enforcement ────────────────────────────────────

  describe('enforceEconomicIntegrity', () => {
    it('reports balanced ledger with no violations', () => {
      const result = enforceEconomicIntegrity(
        makeContext(),
        [
          {
            id: 'tx-1',
            entries: [
              { id: 'e1', transactionId: 'tx-1', accountId: 'a1', direction: 'debit', amount: 500, currency: 'USD', createdAt: now },
              { id: 'e2', transactionId: 'tx-1', accountId: 'a2', direction: 'credit', amount: 500, currency: 'USD', createdAt: now },
            ],
            status: 'posted',
            correlationId: 'corr-1',
            createdAt: now,
          },
        ],
        [{ id: 'p1', creatorId: 'c1', amount: 100, currency: 'USD', status: 'completed', ledgerTransactionId: 'tx-1' }],
        [{ id: 'r1', type: 'stream', amount: 100, currency: 'USD', ledgerEntryId: 'e1' }],
      )
      expect(result.ledgerBalanced).toBe(true)
      expect(result.payoutsWithoutBacking).toHaveLength(0)
      expect(result.revenueWithoutLedger).toHaveLength(0)
    })

    it('detects payouts without ledger backing', () => {
      const result = enforceEconomicIntegrity(
        makeContext(),
        [],
        [{ id: 'p-unbacked', creatorId: 'c1', amount: 100, currency: 'USD', status: 'completed' }],
        [],
      )
      expect(result.payoutsWithoutBacking).toContain('p-unbacked')
    })

    it('detects revenue without ledger entries', () => {
      const result = enforceEconomicIntegrity(
        makeContext(),
        [],
        [],
        [{ id: 'r-orphan', type: 'ticket', amount: 50, currency: 'USD' }],
      )
      expect(result.revenueWithoutLedger).toContain('r-orphan')
    })

    it('detects imbalanced transactions', () => {
      const result = enforceEconomicIntegrity(
        makeContext(),
        [{
          id: 'tx-bad',
          entries: [
            { id: 'e1', transactionId: 'tx-bad', accountId: 'a1', direction: 'debit', amount: 200, currency: 'USD', createdAt: now },
            { id: 'e2', transactionId: 'tx-bad', accountId: 'a2', direction: 'credit', amount: 100, currency: 'USD', createdAt: now },
          ],
          status: 'posted',
          correlationId: 'c1',
          createdAt: now,
        }],
        [],
        [],
      )
      expect(result.ledgerBalanced).toBe(false)
      expect(result.unreconciledTransactions).toContain('tx-bad')
    })
  })

  // ── Reconciliation ────────────────────────────────────────────────────

  describe('reconcileAccounts', () => {
    it('reports no discrepancies when balances match', () => {
      const result = reconcileAccounts([
        { accountId: 'acct-1', recordedBalance: 1000, computedBalance: 1000 },
        { accountId: 'acct-2', recordedBalance: 500, computedBalance: 500 },
      ])
      expect(result.reconciled).toBe(true)
      expect(result.discrepancies).toHaveLength(0)
    })

    it('reports discrepancies when balances differ', () => {
      const result = reconcileAccounts([
        { accountId: 'acct-drift', recordedBalance: 1000, computedBalance: 980 },
      ])
      expect(result.reconciled).toBe(false)
      expect(result.discrepancies[0]!.accountId).toBe('acct-drift')
      expect(result.discrepancies[0]!.variance).toBeCloseTo(20, 1)
    })
  })

  // ── Payout Authorization ──────────────────────────────────────────────

  describe('canExecutePayout', () => {
    it('allows payout when all checks pass', () => {
      const result = canExecutePayout(100, 500, false, true)
      expect(result.allowed).toBe(true)
      expect(result.reasons).toHaveLength(0)
    })

    it('blocks payout exceeding available balance', () => {
      const result = canExecutePayout(600, 500, false, true)
      expect(result.allowed).toBe(false)
      expect(result.reasons.some(r => r.includes('exceeds'))).toBe(true)
    })

    it('blocks payout with active dispute', () => {
      const result = canExecutePayout(100, 500, true, true)
      expect(result.allowed).toBe(false)
      expect(result.reasons.some(r => r.includes('dispute'))).toBe(true)
    })

    it('blocks payout without ledger backing', () => {
      const result = canExecutePayout(100, 500, false, false)
      expect(result.allowed).toBe(false)
      expect(result.reasons.some(r => r.includes('backing'))).toBe(true)
    })

    it('blocks zero or negative payout amounts', () => {
      const result = canExecutePayout(0, 500, false, true)
      expect(result.allowed).toBe(false)
      expect(result.reasons.some(r => r.includes('positive'))).toBe(true)
    })

    it('accumulates all failure reasons', () => {
      const result = canExecutePayout(-10, 0, true, false)
      expect(result.allowed).toBe(false)
      expect(result.reasons.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ── Revenue to Ledger Mapping ─────────────────────────────────────────

  describe('validateRevenueToLedgerMapping', () => {
    it('passes when ledger entry exists', () => {
      const result = validateRevenueToLedgerMapping('rev-1', 'ledger-1')
      expect(result.valid).toBe(true)
    })

    it('fails when ledger entry is null', () => {
      const result = validateRevenueToLedgerMapping('rev-1', null)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('rev-1')
    })
  })
})
