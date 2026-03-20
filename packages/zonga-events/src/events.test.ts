import { describe, it, expect } from 'vitest'
import { checkCapacity } from './capacity'
import { validatePromoCode, computeOrderTotal, checkRefundEligibility } from './ticketing'
import { validateScan, resolveOfflineConflicts, computeCheckInStats } from './checkin'
import type { OfflineScanRecord } from './checkin'
import {
  TicketTier, TicketStatus, ScanResult, PromoCodeType,
} from './types'
import type {
  TicketInventory, PromoCode, TicketHolder, TicketScan,
} from './types'

// ── Helpers ─────────────────────────────────────────────────────────────

const NOW = new Date('2025-06-15T14:00:00Z')
const PAST = new Date('2025-06-14T14:00:00Z')
const FUTURE = new Date('2025-06-20T14:00:00Z')

function makeInventory(overrides: Partial<TicketInventory> = {}): TicketInventory {
  return {
    eventId: 'event-1',
    tierId: 'tier-1',
    tier: TicketTier.GENERAL,
    totalQuantity: 500,
    soldQuantity: 100,
    reservedQuantity: 10,
    maxPerOrder: 10,
    salesStartAt: PAST,
    salesEndAt: FUTURE,
    isOnSale: true,
    ...overrides,
  }
}

function makePromoCode(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: 'promo-1',
    eventId: 'event-1',
    orgId: 'org-1',
    code: 'EARLY20',
    type: PromoCodeType.PERCENTAGE,
    value: 20,
    maxUses: 100,
    usedCount: 10,
    applicableTiers: [TicketTier.GENERAL, TicketTier.VIP],
    expiresAt: FUTURE,
    isActive: true,
    createdAt: PAST,
    ...overrides,
  }
}

function makeTicketHolder(overrides: Partial<TicketHolder> = {}): TicketHolder {
  return {
    id: 'ticket-1',
    orderId: 'order-1',
    eventId: 'event-1',
    tier: TicketTier.GENERAL,
    status: TicketStatus.CONFIRMED,
    holderName: 'Kwame Asante',
    holderEmail: 'kwame@example.com',
    qrCode: 'QR-12345',
    scannedAt: null,
    scannedBy: null,
    transferredTo: null,
    createdAt: PAST,
    ...overrides,
  }
}

// ── Capacity Tests ──────────────────────────────────────────────────────

describe('@nzila/zonga-events — capacity', () => {
  it('allows purchase when capacity available', () => {
    const result = checkCapacity(makeInventory(), 2, NOW)
    expect(result.available).toBe(true)
    expect(result.availableQuantity).toBe(390) // 500 - 100 - 10
  })

  it('rejects when not on sale', () => {
    const result = checkCapacity(makeInventory({ isOnSale: false }), 1, NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('not currently on sale')
  })

  it('rejects before sales start', () => {
    const beforeSales = new Date('2025-06-13T00:00:00Z')
    const result = checkCapacity(makeInventory(), 1, beforeSales)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Sales start')
  })

  it('rejects after sales end', () => {
    const afterSales = new Date('2025-06-25T00:00:00Z')
    const result = checkCapacity(makeInventory(), 1, afterSales)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Sales have ended')
  })

  it('rejects exceeding max per order', () => {
    const result = checkCapacity(makeInventory({ maxPerOrder: 4 }), 5, NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Maximum 4')
  })

  it('rejects when sold out', () => {
    const result = checkCapacity(
      makeInventory({ totalQuantity: 100, soldQuantity: 95, reservedQuantity: 5 }),
      1, NOW,
    )
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Sold out')
  })

  it('rejects when insufficient remaining', () => {
    const result = checkCapacity(
      makeInventory({ totalQuantity: 100, soldQuantity: 95, reservedQuantity: 2 }),
      5, NOW,
    )
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Only 3 tickets remaining')
  })
})

// ── Promo & ticketing Tests ─────────────────────────────────────────────

describe('@nzila/zonga-events — ticketing', () => {
  it('validates active percentage promo code', () => {
    const result = validatePromoCode(makePromoCode(), 100, TicketTier.GENERAL, NOW)
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(20) // 20% of 100
  })

  it('rejects expired promo code', () => {
    const result = validatePromoCode(
      makePromoCode({ expiresAt: PAST }),
      100, TicketTier.GENERAL, NOW,
    )
    expect(result.valid).toBe(false)
  })

  it('rejects exceeded usage', () => {
    const result = validatePromoCode(
      makePromoCode({ maxUses: 10, usedCount: 10 }),
      100, TicketTier.GENERAL, NOW,
    )
    expect(result.valid).toBe(false)
  })

  it('rejects non-applicable tier', () => {
    const result = validatePromoCode(makePromoCode(), 100, TicketTier.VVIP, NOW)
    expect(result.valid).toBe(false)
  })

  it('computes order total with percentage discount', () => {
    const items = [
      { price: 50, quantity: 1 },
      { price: 50, quantity: 1 },
    ]
    const result = computeOrderTotal(items, 20) // 20 discount
    expect(result.subtotal).toBe(100)
    expect(result.discount).toBe(20)
    expect(result.total).toBe(80)
  })

  it('approves full refund for cancelled event', () => {
    const order = {
      id: 'order-1', orgId: 'org-1', eventId: 'event-1', buyerId: 'buyer-1',
      buyerEmail: 'buyer@example.com', items: [], subtotal: 100, discount: 0,
      total: 100, currency: 'KES', promoCodeId: null, paymentRef: null,
      status: 'confirmed' as const, createdAt: PAST, confirmedAt: PAST,
    }
    const eventDate = new Date('2025-06-20T20:00:00Z')
    const result = checkRefundEligibility(order, eventDate, 'cancelled', NOW)
    expect(result.eligible).toBe(true)
    expect(result.maxRefundAmount).toBe(100)
  })
})

// ── Check-in Tests ──────────────────────────────────────────────────────

describe('@nzila/zonga-events — checkin', () => {
  it('validates a confirmed ticket scan', () => {
    const holder = makeTicketHolder()
    const result = validateScan('ticket-1', 'event-1', null, holder, [], [])
    expect(result.result).toBe(ScanResult.VALID)
  })

  it('rejects scan for wrong event', () => {
    const holder = makeTicketHolder()
    const result = validateScan('ticket-1', 'event-999', null, holder, [], [])
    expect(result.result).toBe(ScanResult.WRONG_EVENT)
  })

  it('rejects duplicate scan', () => {
    const holder = makeTicketHolder({ status: TicketStatus.CHECKED_IN, scannedAt: PAST })
    const existingScans: TicketScan[] = [{
      id: 's0', ticketId: 'ticket-1', eventId: 'event-1', sessionId: null,
      result: ScanResult.VALID, scannedBy: 'staff', scannedAt: PAST,
      deviceId: null, offlineSync: false, conflictResolved: false,
    }]
    const result = validateScan('ticket-1', 'event-1', null, holder, existingScans, [])
    expect(result.result).toBe(ScanResult.ALREADY_SCANNED)
  })

  it('rejects cancelled ticket', () => {
    const holder = makeTicketHolder({ status: TicketStatus.CANCELLED })
    const result = validateScan('ticket-1', 'event-1', null, holder, [], [])
    expect(result.result).toBe(ScanResult.INVALID)
  })

  it('resolves offline conflicts (first-writer-wins)', () => {
    const records: OfflineScanRecord[] = [
      {
        ticketId: 'ticket-1', eventId: 'event-1', sessionId: null,
        scannedAt: new Date('2025-06-15T18:01:00Z'),
        scannerDeviceId: 'dev-a', synced: false,
      },
      {
        ticketId: 'ticket-1', eventId: 'event-1', sessionId: null,
        scannedAt: new Date('2025-06-15T18:02:00Z'),
        scannerDeviceId: 'dev-b', synced: false,
      },
    ]
    const resolved = resolveOfflineConflicts(records)
    expect(resolved).toHaveLength(1)
    expect(resolved[0]!.hasConflict).toBe(true)
    expect(resolved[0]!.winner!.scannerDeviceId).toBe('dev-a')
  })

  it('computes check-in statistics', () => {
    const holders: TicketHolder[] = [
      makeTicketHolder({ id: 't1', tier: TicketTier.GENERAL }),
      makeTicketHolder({ id: 't2', tier: TicketTier.GENERAL }),
      makeTicketHolder({ id: 't3', tier: TicketTier.VIP }),
    ]
    const scans: TicketScan[] = [
      {
        id: 's1', ticketId: 't1', eventId: 'e1', sessionId: null,
        result: ScanResult.VALID, scannedBy: 'staff', scannedAt: NOW,
        deviceId: null, offlineSync: false, conflictResolved: false,
      },
      {
        id: 's2', ticketId: 't2', eventId: 'e1', sessionId: null,
        result: ScanResult.VALID, scannedBy: 'staff', scannedAt: NOW,
        deviceId: null, offlineSync: false, conflictResolved: false,
      },
      {
        id: 's3', ticketId: 't3', eventId: 'e1', sessionId: null,
        result: ScanResult.ALREADY_SCANNED, scannedBy: 'staff', scannedAt: NOW,
        deviceId: null, offlineSync: false, conflictResolved: false,
      },
    ]
    const stats = computeCheckInStats(holders, scans)
    expect(stats.totalTickets).toBe(3)
    expect(stats.checkedIn).toBe(2) // t1 and t2 have VALID scans
    expect(stats.checkInRate).toBeCloseTo(66.67) // 2/3 * 100, rounded to 2 decimals
  })
})
