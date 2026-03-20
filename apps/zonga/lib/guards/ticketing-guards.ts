/**
 * Zonga — Ticketing Concurrency Guards (T1–T6)
 *
 * Runtime enforcement of ticketing invariants.
 *
 * T1: No overselling (tickets sold ≤ capacity)
 * T2: Atomic ticket reservation (no read-then-write race)
 * T3: Refund eligibility window enforcement
 * T4: No duplicate ticket scans
 * T5: Cancelled events block new purchases
 * T6: Transfer validation (ownership chain)
 */

import { logger } from '@/lib/logger'

export interface TicketingGuardResult {
  passed: boolean
  invariant: string
  details?: string
}

/** T1: Tickets sold must not exceed capacity */
export function guardNoOversell(
  ticketsSold: number,
  capacity: number,
): TicketingGuardResult {
  if (ticketsSold > capacity) {
    logger.error('T1 VIOLATION: Event oversold', { ticketsSold, capacity })
    return {
      passed: false,
      invariant: 'T1_NO_OVERSELL',
      details: `${ticketsSold} tickets sold exceeds capacity of ${capacity}`,
    }
  }
  return { passed: true, invariant: 'T1_NO_OVERSELL' }
}

/** T2: Verify atomic reservation was used (result of INSERT...WHERE COUNT < capacity) */
export function guardAtomicReservation(insertedCount: number): TicketingGuardResult {
  if (insertedCount === 0) {
    return {
      passed: false,
      invariant: 'T2_ATOMIC_RESERVATION',
      details: 'Atomic reservation failed — capacity reached during concurrent purchase',
    }
  }
  return { passed: true, invariant: 'T2_ATOMIC_RESERVATION' }
}

/** T3: Refund eligibility — events must not have started */
export function guardRefundEligibility(
  eventStartsAt: Date,
  now: Date = new Date(),
  refundCutoffHours: number = 24,
): TicketingGuardResult {
  const cutoffMs = refundCutoffHours * 60 * 60 * 1000
  const timeUntilEvent = eventStartsAt.getTime() - now.getTime()

  if (timeUntilEvent < cutoffMs) {
    return {
      passed: false,
      invariant: 'T3_REFUND_ELIGIBILITY',
      details: `Event starts in ${Math.round(timeUntilEvent / 3600000)}h — refund cutoff is ${refundCutoffHours}h`,
    }
  }
  return { passed: true, invariant: 'T3_REFUND_ELIGIBILITY' }
}

/** T4: No duplicate scans — ticket must not already be scanned */
export function guardNoDuplicateScan(
  ticketStatus: string,
): TicketingGuardResult {
  if (ticketStatus === 'used') {
    return {
      passed: false,
      invariant: 'T4_NO_DUPLICATE_SCAN',
      details: 'Ticket has already been scanned',
    }
  }
  if (ticketStatus === 'cancelled' || ticketStatus === 'refunded') {
    return {
      passed: false,
      invariant: 'T4_NO_DUPLICATE_SCAN',
      details: `Cannot scan ticket in status: ${ticketStatus}`,
    }
  }
  return { passed: true, invariant: 'T4_NO_DUPLICATE_SCAN' }
}

/** T5: Cancelled events block new ticket purchases */
export function guardEventNotCancelled(
  eventStatus: string,
): TicketingGuardResult {
  if (eventStatus === 'cancelled' || eventStatus === 'completed') {
    return {
      passed: false,
      invariant: 'T5_EVENT_NOT_CANCELLED',
      details: `Cannot purchase tickets for event in status: ${eventStatus}`,
    }
  }
  return { passed: true, invariant: 'T5_EVENT_NOT_CANCELLED' }
}

/** T6: Transfer validation — verify ownership chain */
export function guardTransferOwnership(
  currentOwnerId: string,
  requesterId: string,
  ticketStatus: string,
): TicketingGuardResult {
  if (currentOwnerId !== requesterId) {
    return {
      passed: false,
      invariant: 'T6_TRANSFER_OWNERSHIP',
      details: `Requester ${requesterId} is not the ticket owner ${currentOwnerId}`,
    }
  }
  if (ticketStatus !== 'confirmed') {
    return {
      passed: false,
      invariant: 'T6_TRANSFER_OWNERSHIP',
      details: `Cannot transfer ticket in status: ${ticketStatus}`,
    }
  }
  return { passed: true, invariant: 'T6_TRANSFER_OWNERSHIP' }
}
