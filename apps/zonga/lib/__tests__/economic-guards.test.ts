/**
 * Zonga — Economic Guards Test Suite
 *
 * Validates E1-E6 invariant guards enforce correctly.
 */
import { describe, it, expect } from 'vitest'
import {
  guardRevenueHasLedgerBacking,
  guardPayoutWithinBalance,
  guardLedgerBalanced,
  guardNoNegativePayout,
  guardTransactionReversible,
  guardSettlementReconciled,
  runEconomicGuards,
} from '../guards/economic-guards'

describe('Economic invariant guards', () => {
  describe('E1: guardRevenueHasLedgerBacking', () => {
    it('passes when ledger backing exists', () => {
      expect(guardRevenueHasLedgerBacking(true).passed).toBe(true)
    })

    it('fails when ledger backing is missing', () => {
      const result = guardRevenueHasLedgerBacking(false)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('E1_NO_REVENUE_WITHOUT_LEDGER')
    })
  })

  describe('E2: guardPayoutWithinBalance', () => {
    it('passes when payout is within balance', () => {
      expect(guardPayoutWithinBalance(100, 500).passed).toBe(true)
    })

    it('passes when payout equals balance', () => {
      expect(guardPayoutWithinBalance(500, 500).passed).toBe(true)
    })

    it('fails when payout exceeds balance', () => {
      const result = guardPayoutWithinBalance(600, 500)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('E2_NO_PAYOUT_EXCEEDING_BALANCE')
    })
  })

  describe('E3: guardLedgerBalanced', () => {
    it('passes when debits equal credits', () => {
      expect(guardLedgerBalanced(1000, 1000).passed).toBe(true)
    })

    it('passes within tolerance ($0.001)', () => {
      expect(guardLedgerBalanced(1000, 1000.0005).passed).toBe(true)
    })

    it('fails when discrepancy exceeds tolerance', () => {
      const result = guardLedgerBalanced(1000, 1001)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('E3_LEDGER_BALANCED')
    })
  })

  describe('E4: guardNoNegativePayout', () => {
    it('passes for positive amount', () => {
      expect(guardNoNegativePayout(100).passed).toBe(true)
    })

    it('passes for zero amount', () => {
      expect(guardNoNegativePayout(0).passed).toBe(true)
    })

    it('fails for negative amount', () => {
      const result = guardNoNegativePayout(-50)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('E4_NO_NEGATIVE_PAYOUT')
    })
  })

  describe('E5: guardTransactionReversible', () => {
    it('passes when reversal path exists', () => {
      expect(guardTransactionReversible(true, 'tx-1').passed).toBe(true)
    })

    it('fails when no reversal path', () => {
      const result = guardTransactionReversible(false, 'tx-1')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('E5_TRANSACTION_REVERSIBLE')
    })
  })

  describe('E6: guardSettlementReconciled', () => {
    it('passes when fully reconciled', () => {
      expect(guardSettlementReconciled(10, 10).passed).toBe(true)
    })

    it('fails when partially reconciled', () => {
      const result = guardSettlementReconciled(10, 7)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('E6_SETTLEMENT_RECONCILED')
    })
  })

  describe('runEconomicGuards (batch)', () => {
    it('returns empty array when no inputs apply', () => {
      expect(runEconomicGuards({})).toEqual([])
    })

    it('runs multiple guards and returns all results', () => {
      const results = runEconomicGuards({
        hasLedgerBacking: true,
        payoutAmount: 100,
        availableBalance: 500,
        amount: 100,
      })
      expect(results.length).toBe(3)
      expect(results.every((r) => r.passed)).toBe(true)
    })

    it('returns failures for violating inputs', () => {
      const results = runEconomicGuards({
        hasLedgerBacking: false,
        payoutAmount: 600,
        availableBalance: 500,
        amount: -10,
      })
      expect(results.length).toBe(3)
      expect(results.every((r) => !r.passed)).toBe(true)
    })
  })
})
