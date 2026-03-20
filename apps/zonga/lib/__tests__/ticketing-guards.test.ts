/**
 * Zonga — Ticketing Guards Test Suite
 *
 * Validates T1-T6 ticketing concurrency invariant guards.
 */
import { describe, it, expect } from 'vitest'
import {
  guardNoOversell,
  guardAtomicReservation,
  guardRefundEligibility,
  guardNoDuplicateScan,
  guardEventNotCancelled,
  guardTransferOwnership,
} from '../guards/ticketing-guards'

describe('Ticketing invariant guards', () => {
  describe('T1: guardNoOversell', () => {
    it('passes when sold < capacity', () => {
      expect(guardNoOversell(50, 100).passed).toBe(true)
    })

    it('passes when sold equals capacity', () => {
      expect(guardNoOversell(100, 100).passed).toBe(true)
    })

    it('fails when sold exceeds capacity', () => {
      const result = guardNoOversell(101, 100)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('T1_NO_OVERSELL')
    })
  })

  describe('T2: guardAtomicReservation', () => {
    it('passes when insert succeeds (count > 0)', () => {
      expect(guardAtomicReservation(1).passed).toBe(true)
    })

    it('fails when insert returns 0 (capacity reached)', () => {
      const result = guardAtomicReservation(0)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('T2_ATOMIC_RESERVATION')
    })
  })

  describe('T3: guardRefundEligibility', () => {
    it('passes when event is far in the future', () => {
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000)
      expect(guardRefundEligibility(future).passed).toBe(true)
    })

    it('fails when event is within cutoff window', () => {
      const soon = new Date(Date.now() + 12 * 60 * 60 * 1000)
      const result = guardRefundEligibility(soon)
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('T3_REFUND_ELIGIBILITY')
    })

    it('fails for past events', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000)
      expect(guardRefundEligibility(past).passed).toBe(false)
    })

    it('respects custom cutoff hours', () => {
      const future = new Date(Date.now() + 6 * 60 * 60 * 1000)
      expect(guardRefundEligibility(future, new Date(), 4).passed).toBe(true)
      expect(guardRefundEligibility(future, new Date(), 8).passed).toBe(false)
    })
  })

  describe('T4: guardNoDuplicateScan', () => {
    it('passes for confirmed tickets', () => {
      expect(guardNoDuplicateScan('confirmed').passed).toBe(true)
    })

    it('fails for already-used tickets', () => {
      const result = guardNoDuplicateScan('used')
      expect(result.passed).toBe(false)
      expect(result.details).toContain('already been scanned')
    })

    it('fails for cancelled tickets', () => {
      expect(guardNoDuplicateScan('cancelled').passed).toBe(false)
    })

    it('fails for refunded tickets', () => {
      expect(guardNoDuplicateScan('refunded').passed).toBe(false)
    })
  })

  describe('T5: guardEventNotCancelled', () => {
    it('passes for published events', () => {
      expect(guardEventNotCancelled('published').passed).toBe(true)
    })

    it('passes for draft events', () => {
      expect(guardEventNotCancelled('draft').passed).toBe(true)
    })

    it('fails for cancelled events', () => {
      const result = guardEventNotCancelled('cancelled')
      expect(result.passed).toBe(false)
      expect(result.invariant).toBe('T5_EVENT_NOT_CANCELLED')
    })

    it('fails for completed events', () => {
      expect(guardEventNotCancelled('completed').passed).toBe(false)
    })
  })

  describe('T6: guardTransferOwnership', () => {
    it('passes when requester is owner and ticket is confirmed', () => {
      expect(guardTransferOwnership('user-1', 'user-1', 'confirmed').passed).toBe(true)
    })

    it('fails when requester is not the owner', () => {
      const result = guardTransferOwnership('user-1', 'user-2', 'confirmed')
      expect(result.passed).toBe(false)
      expect(result.details).toContain('not the ticket owner')
    })

    it('fails when ticket is not in confirmed status', () => {
      const result = guardTransferOwnership('user-1', 'user-1', 'used')
      expect(result.passed).toBe(false)
      expect(result.details).toContain('Cannot transfer ticket')
    })
  })
})
