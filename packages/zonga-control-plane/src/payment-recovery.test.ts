import { describe, it, expect, beforeEach } from 'vitest'
import type { ControlPlaneContext } from './types'
import { SystemEventType } from './types'
import { clearEventLog, getEventLog } from './system-events'
import {
  planPaymentRecovery,
  validateRefundRequest,
  processRefund,
  type PaymentIntent,
  type RefundRequest,
} from './payment-recovery'

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

function makeIntent(overrides?: Partial<PaymentIntent>): PaymentIntent {
  return {
    id: 'pi-1',
    customerId: 'cust-1',
    amount: 100,
    currency: 'USD',
    status: 'failed',
    provider: 'stripe',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    ...overrides,
  }
}

describe('@nzila/zonga-control-plane — Payment Recovery', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── planPaymentRecovery ───────────────────────────────────────────

  describe('planPaymentRecovery', () => {
    it('returns recovered for succeeded payment', () => {
      const intent = makeIntent({ status: 'succeeded' })
      const result = planPaymentRecovery(intent)
      expect(result.recovered).toBe(true)
      expect(result.newStatus).toBe('succeeded')
    })

    it('returns unrecoverable for cancelled payment', () => {
      const intent = makeIntent({ status: 'cancelled' })
      const result = planPaymentRecovery(intent)
      expect(result.recovered).toBe(false)
      expect(result.newStatus).toBe('cancelled')
      expect(result.error).toContain('cancelled')
    })

    it('returns failure when max retries exhausted', () => {
      const intent = makeIntent({ retryCount: 3, maxRetries: 3 })
      const result = planPaymentRecovery(intent)
      expect(result.recovered).toBe(false)
      expect(result.newStatus).toBe('failed')
      expect(result.error).toContain('Max retries')
    })

    it('schedules retry with incremented count', () => {
      const intent = makeIntent({ retryCount: 0, maxRetries: 5 })
      const result = planPaymentRecovery(intent)
      expect(result.recovered).toBe(false)
      expect(result.newStatus).toBe('pending')
      expect(result.retryCount).toBe(1)
      expect(result.nextRetryAt).toBeDefined()
    })

    it('increases delay for subsequent retries', () => {
      const r0 = planPaymentRecovery(makeIntent({ retryCount: 0 }))
      const r1 = planPaymentRecovery(makeIntent({ retryCount: 1 }))
      const r2 = planPaymentRecovery(makeIntent({ retryCount: 2 }))

      // Each retry should be scheduled later than the previous
      expect(r1.nextRetryAt!.getTime()).toBeGreaterThan(r0.nextRetryAt!.getTime())
      expect(r2.nextRetryAt!.getTime()).toBeGreaterThan(r1.nextRetryAt!.getTime())
    })
  })

  // ── validateRefundRequest ─────────────────────────────────────────

  describe('validateRefundRequest', () => {
    it('validates a correct refund', () => {
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 50,
        reason: 'Customer requested refund',
        requestedBy: 'actor-test',
      }
      const result = validateRefundRequest(request, 100, 0)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects zero amount', () => {
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 0,
        reason: 'Refund for cancelled event',
        requestedBy: 'actor-test',
      }
      const result = validateRefundRequest(request, 100, 0)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('positive'))).toBe(true)
    })

    it('rejects refund exceeding remaining refundable', () => {
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 80,
        reason: 'Full refund',
        requestedBy: 'actor-test',
      }
      const result = validateRefundRequest(request, 100, 50)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('exceeds'))).toBe(true)
    })

    it('rejects empty reason', () => {
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 20,
        reason: '',
        requestedBy: 'actor-test',
      }
      const result = validateRefundRequest(request, 100, 0)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('reason'))).toBe(true)
    })

    it('accumulates multiple errors', () => {
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: -5,
        reason: 'ab',
        requestedBy: 'actor-test',
      }
      const result = validateRefundRequest(request, 100, 0)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ── processRefund ─────────────────────────────────────────────────

  describe('processRefund', () => {
    it('processes valid refund and returns pending status', () => {
      const ctx = makeContext()
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 30,
        reason: 'Event cancelled by organizer',
        requestedBy: 'actor-test',
      }
      const result = processRefund(ctx, request, 100, 0)
      expect(result.status).toBe('pending')
      expect(result.amount).toBe(30)
      expect(result.ledgerReversalId).toBeTruthy()
      expect(result.refundId).toBeTruthy()
    })

    it('fails for invalid refund request', () => {
      const ctx = makeContext()
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 200,
        reason: 'Refund too large',
        requestedBy: 'actor-test',
      }
      const result = processRefund(ctx, request, 100, 0)
      expect(result.status).toBe('failed')
      expect(result.error).toBeTruthy()
    })

    it('emits audit event for valid refund', () => {
      const ctx = makeContext()
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 25,
        reason: 'Duplicate purchase refund',
        requestedBy: 'actor-test',
      }
      processRefund(ctx, request, 100, 0)

      const events = getEventLog()
      const refundEvent = events.find((e) => e.type === SystemEventType.TICKET_REFUNDED)
      expect(refundEvent).toBeDefined()
      expect(refundEvent!.payload['amount']).toBe(25)
    })

    it('does not emit event for failed refund', () => {
      const ctx = makeContext()
      const request: RefundRequest = {
        captureId: 'cap-1',
        amount: 0,
        reason: 'bad',
        requestedBy: 'actor-test',
      }
      processRefund(ctx, request, 100, 0)

      const events = getEventLog()
      expect(events.filter((e) => e.type === SystemEventType.TICKET_REFUNDED)).toHaveLength(0)
    })
  })
})
