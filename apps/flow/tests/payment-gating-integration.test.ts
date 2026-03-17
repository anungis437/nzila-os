/**
 * Flow — Payment Gating Integration Tests
 *
 * Validates payment gate rules:
 *   - Deposit must be collected before PO creation
 *   - Overdue payments block production
 *   - Payment status transitions are enforced
 */
import { describe, it, expect } from 'vitest'

// ── Payment domain logic under test ───────────────────────────────────────

const VALID_PAYMENT_TRANSITIONS: Record<string, string[]> = {
  not_required: [],
  pending_deposit: ['partially_paid', 'paid', 'overdue', 'failed'],
  partially_paid: ['paid', 'overdue', 'failed'],
  paid: ['refunded'],
  overdue: ['partially_paid', 'paid', 'failed'],
  failed: ['pending_deposit'],
  refunded: [],
}

function isValidPaymentTransition(from: string, to: string): boolean {
  return VALID_PAYMENT_TRANSITIONS[from]?.includes(to) ?? false
}

function evaluateDepositGate(payment: {
  depositRequired: boolean
  depositPercent: number
  amountDue: number
  amountPaid: number
}): { passed: boolean; reason?: string } {
  if (!payment.depositRequired) return { passed: true }
  const depositAmount = payment.amountDue * (payment.depositPercent / 100)
  if (payment.amountPaid >= depositAmount) return { passed: true }
  return {
    passed: false,
    reason: `Deposit of ${depositAmount.toFixed(2)} required, only ${payment.amountPaid.toFixed(2)} received`,
  }
}

function evaluateProductionGate(payments: { status: string }[]): {
  passed: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  const hasOverdue = payments.some((p) => p.status === 'overdue')
  if (hasOverdue) blockers.push('Outstanding overdue payment')
  const hasFailed = payments.some((p) => p.status === 'failed')
  if (hasFailed) blockers.push('Failed payment requires resolution')
  return { passed: blockers.length === 0, blockers }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Payment Gating', () => {
  describe('Payment status transitions', () => {
    it('allows pending_deposit → partially_paid', () => {
      expect(isValidPaymentTransition('pending_deposit', 'partially_paid')).toBe(true)
    })

    it('allows pending_deposit → paid', () => {
      expect(isValidPaymentTransition('pending_deposit', 'paid')).toBe(true)
    })

    it('allows partially_paid → paid', () => {
      expect(isValidPaymentTransition('partially_paid', 'paid')).toBe(true)
    })

    it('allows paid → refunded', () => {
      expect(isValidPaymentTransition('paid', 'refunded')).toBe(true)
    })

    it('blocks paid → pending_deposit (backward transition)', () => {
      expect(isValidPaymentTransition('paid', 'pending_deposit')).toBe(false)
    })

    it('blocks refunded → paid', () => {
      expect(isValidPaymentTransition('refunded', 'paid')).toBe(false)
    })

    it('allows overdue → paid (late payment recovery)', () => {
      expect(isValidPaymentTransition('overdue', 'paid')).toBe(true)
    })

    it('blocks not_required from any transition', () => {
      expect(isValidPaymentTransition('not_required', 'paid')).toBe(false)
      expect(isValidPaymentTransition('not_required', 'pending_deposit')).toBe(false)
    })
  })

  describe('Deposit gate', () => {
    it('passes when deposit not required', () => {
      const result = evaluateDepositGate({
        depositRequired: false,
        depositPercent: 0,
        amountDue: 10000,
        amountPaid: 0,
      })
      expect(result.passed).toBe(true)
    })

    it('passes when deposit fully paid', () => {
      const result = evaluateDepositGate({
        depositRequired: true,
        depositPercent: 50,
        amountDue: 10000,
        amountPaid: 5000,
      })
      expect(result.passed).toBe(true)
    })

    it('passes when overpaid', () => {
      const result = evaluateDepositGate({
        depositRequired: true,
        depositPercent: 30,
        amountDue: 10000,
        amountPaid: 5000,
      })
      expect(result.passed).toBe(true)
    })

    it('fails when deposit underpaid', () => {
      const result = evaluateDepositGate({
        depositRequired: true,
        depositPercent: 50,
        amountDue: 10000,
        amountPaid: 2000,
      })
      expect(result.passed).toBe(false)
      expect(result.reason).toContain('5000.00')
      expect(result.reason).toContain('2000.00')
    })

    it('fails when nothing paid on required deposit', () => {
      const result = evaluateDepositGate({
        depositRequired: true,
        depositPercent: 25,
        amountDue: 8000,
        amountPaid: 0,
      })
      expect(result.passed).toBe(false)
    })
  })

  describe('Production gate', () => {
    it('passes with no payments', () => {
      const result = evaluateProductionGate([])
      expect(result.passed).toBe(true)
      expect(result.blockers).toHaveLength(0)
    })

    it('passes when all payments current', () => {
      const result = evaluateProductionGate([
        { status: 'paid' },
        { status: 'partially_paid' },
      ])
      expect(result.passed).toBe(true)
    })

    it('fails with overdue payment', () => {
      const result = evaluateProductionGate([
        { status: 'paid' },
        { status: 'overdue' },
      ])
      expect(result.passed).toBe(false)
      expect(result.blockers).toContain('Outstanding overdue payment')
    })

    it('fails with failed payment', () => {
      const result = evaluateProductionGate([
        { status: 'failed' },
      ])
      expect(result.passed).toBe(false)
      expect(result.blockers).toContain('Failed payment requires resolution')
    })

    it('accumulates multiple blockers', () => {
      const result = evaluateProductionGate([
        { status: 'overdue' },
        { status: 'failed' },
      ])
      expect(result.passed).toBe(false)
      expect(result.blockers).toHaveLength(2)
    })
  })
})
