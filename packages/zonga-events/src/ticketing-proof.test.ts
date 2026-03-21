/**
 * @nzila/zonga-events — Ticketing Operational Proof Suite
 *
 * Covers TKT-1 through TKT-7 from PROOF_TARGET_MATRIX.md:
 *   TKT-1: Capacity guard — no oversell
 *   TKT-2: Promo code validation
 *   TKT-3: Refund eligibility (>48h full, 24-48h 50%, <24h none, cancelled/postponed full)
 *   TKT-4: Duplicate scan prevention
 *   TKT-5: Offline conflict resolution (first-writer-wins)
 *   TKT-6: Transfer validation (CONFIRMED only, max 3, no pending)
 *   TKT-7: Event settlement (readiness, revenue, splits)
 */
import { describe, it, expect } from 'vitest'
import { checkCapacity, buildCapacityModel, computeSellThrough } from './capacity'
import { validatePromoCode, computeOrderTotal, validateTransfer, checkRefundEligibility } from './ticketing'
import { validateScan, resolveOfflineConflicts, buildOfflineCache, computeCheckInStats } from './checkin'
import type { OfflineScanRecord, CheckInResult } from './checkin'
import { checkSettlementReadiness, computeEventRevenue, buildEventSettlement, DEFAULT_EVENT_SPLITS } from './event-settlement'
import type {
  TicketInventory,
  TicketHolder,
  TicketScan,
  TicketTransfer,
  TicketOrder,
  PromoCode,
  EventSession,
  Event,
} from './types'
import { TicketStatus, TicketTier, ScanResult, EventStatus, SessionStatus, TransferStatus } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────

let _id = 0
function nextId(): string { return `proof-${++_id}` }

function hours(h: number): number { return h * 60 * 60 * 1000 }

const BASE_NOW = new Date('2025-06-15T12:00:00Z')

function makeInventory(overrides: Partial<TicketInventory> = {}): TicketInventory {
  return {
    eventId: 'evt-1',
    tierId: nextId(),
    tier: TicketTier.GENERAL,
    totalQuantity: 100,
    soldQuantity: 0,
    reservedQuantity: 0,
    maxPerOrder: 10,
    salesStartAt: new Date('2025-01-01'),
    salesEndAt: new Date('2025-12-31'),
    isOnSale: true,
    ...overrides,
  }
}

function makeHolder(overrides: Partial<TicketHolder> = {}): TicketHolder {
  const id = nextId()
  return {
    id,
    orderId: `order-${id}`,
    eventId: 'evt-1',
    tier: TicketTier.GENERAL,
    status: TicketStatus.CONFIRMED,
    holderName: 'Test Holder',
    holderEmail: 'holder@test.com',
    qrCode: `QR-${id}`,
    scannedAt: null,
    scannedBy: null,
    transferredTo: null,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeScan(overrides: Partial<TicketScan> = {}): TicketScan {
  return {
    id: nextId(),
    ticketId: 'ticket-1',
    eventId: 'evt-1',
    sessionId: null,
    result: ScanResult.VALID,
    scannedBy: 'scanner-1',
    scannedAt: new Date(),
    deviceId: 'device-1',
    offlineSync: false,
    conflictResolved: false,
    ...overrides,
  }
}

function makeTransfer(overrides: Partial<TicketTransfer> = {}): TicketTransfer {
  return {
    id: nextId(),
    ticketId: 'ticket-1',
    fromHolderId: 'holder-1',
    toEmail: 'recipient@test.com',
    toName: 'Recipient',
    status: TransferStatus.ACCEPTED,
    transferReason: null,
    createdAt: new Date(),
    acceptedAt: new Date(),
    expiresAt: new Date(Date.now() + hours(72)),
    ...overrides,
  }
}

function makePromo(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: nextId(),
    eventId: 'evt-1',
    orgId: 'org-1',
    code: 'TEST20',
    type: 'percentage',
    value: 20,
    maxUses: 100,
    usedCount: 0,
    applicableTiers: [],
    expiresAt: new Date('2025-12-31'),
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  }
}

function makeOrder(overrides: Partial<TicketOrder> = {}): TicketOrder {
  return {
    id: nextId(),
    orgId: 'org-1',
    eventId: 'evt-1',
    buyerId: 'buyer-1',
    buyerEmail: 'buyer@test.com',
    items: [],
    subtotal: 100,
    discount: 0,
    total: 100,
    currency: 'USD',
    promoCodeId: null,
    paymentRef: null,
    status: 'confirmed',
    createdAt: new Date(),
    confirmedAt: new Date(),
    ...overrides,
  }
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt-1',
    orgId: 'org-1',
    type: 'concert',
    status: EventStatus.COMPLETED,
    title: 'Test Concert',
    description: 'A test event',
    venueId: 'venue-1',
    venueName: 'Test Venue',
    city: 'Kinshasa',
    country: 'CD',
    startsAt: new Date('2025-06-15T20:00:00Z'),
    endsAt: new Date('2025-06-15T23:00:00Z'),
    doorsOpenAt: new Date('2025-06-15T18:00:00Z'),
    timezone: 'UTC',
    imageUrl: null,
    artistIds: ['artist-1'],
    promoterId: 'promoter-1',
    sessions: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeSession(overrides: Partial<EventSession> = {}): EventSession {
  return {
    id: nextId(),
    eventId: 'evt-1',
    title: 'Main Session',
    status: SessionStatus.LIVE,
    startsAt: new Date('2025-06-15T19:00:00Z'),
    endsAt: new Date('2025-06-15T23:00:00Z'),
    artistIds: ['artist-1'],
    stageOrZone: 'Main Stage',
    ...overrides,
  }
}

function makeOfflineScan(overrides: Partial<OfflineScanRecord> = {}): OfflineScanRecord {
  return {
    ticketId: 'ticket-1',
    eventId: 'evt-1',
    sessionId: null,
    scannedAt: new Date(),
    scannerDeviceId: 'device-1',
    synced: false,
    ...overrides,
  }
}

// ── TKT-1: Capacity Guard — No Oversell ────────────────────────────────

describe('TKT-1: Capacity guard — no oversell', () => {
  it('allows purchase within capacity', () => {
    const inv = makeInventory({ totalQuantity: 100, soldQuantity: 10, reservedQuantity: 5 })
    const result = checkCapacity(inv, 5, BASE_NOW)
    expect(result.available).toBe(true)
    expect(result.availableQuantity).toBe(85)
  })

  it('rejects purchase exceeding remaining capacity', () => {
    const inv = makeInventory({ totalQuantity: 100, soldQuantity: 95, reservedQuantity: 3 })
    const result = checkCapacity(inv, 5, BASE_NOW)
    expect(result.available).toBe(false)
    expect(result.availableQuantity).toBe(2)
    expect(result.reason).toContain('2')
  })

  it('rejects when sold out', () => {
    const inv = makeInventory({ totalQuantity: 50, soldQuantity: 50, reservedQuantity: 0 })
    const result = checkCapacity(inv, 1, BASE_NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Sold out')
  })

  it('enforces maxPerOrder limit', () => {
    const inv = makeInventory({ maxPerOrder: 4 })
    const result = checkCapacity(inv, 5, BASE_NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Maximum 4')
  })

  it('rejects when not on sale', () => {
    const inv = makeInventory({ isOnSale: false })
    const result = checkCapacity(inv, 1, BASE_NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('not currently on sale')
  })

  it('rejects before sales window opens', () => {
    const inv = makeInventory({ salesStartAt: new Date('2025-07-01') })
    const result = checkCapacity(inv, 1, BASE_NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Sales start at')
  })

  it('rejects after sales window closes', () => {
    const inv = makeInventory({ salesEndAt: new Date('2025-01-01') })
    const result = checkCapacity(inv, 1, BASE_NOW)
    expect(result.available).toBe(false)
    expect(result.reason).toContain('Sales have ended')
  })

  it('stress: 1000 sequential capacity checks never oversell', () => {
    let sold = 0
    const total = 200
    for (let i = 0; i < 1000; i++) {
      const qty = Math.ceil(Math.random() * 5)
      const inv = makeInventory({ totalQuantity: total, soldQuantity: sold, reservedQuantity: 0, maxPerOrder: 10 })
      const result = checkCapacity(inv, qty, BASE_NOW)
      if (result.available) {
        sold += qty
      }
      // Invariant: sold never exceeds total
      expect(sold).toBeLessThanOrEqual(total)
    }
  })

  it('buildCapacityModel aggregates across tiers', () => {
    const invs = [
      makeInventory({ eventId: 'evt-1', tier: TicketTier.GENERAL, totalQuantity: 100, soldQuantity: 20, reservedQuantity: 5 }),
      makeInventory({ eventId: 'evt-1', tier: TicketTier.VIP, totalQuantity: 50, soldQuantity: 10, reservedQuantity: 2 }),
      makeInventory({ eventId: 'evt-2', tier: TicketTier.GENERAL, totalQuantity: 200, soldQuantity: 0, reservedQuantity: 0 }),
    ]
    const model = buildCapacityModel('evt-1', invs)
    expect(model.tiers).toHaveLength(2)
    expect(model.totalCapacity).toBe(150) // 100 + 50
  })

  it('computeSellThrough percentage is correct', () => {
    const model = buildCapacityModel('evt-1', [
      makeInventory({ eventId: 'evt-1', totalQuantity: 100, soldQuantity: 75, reservedQuantity: 0 }),
    ])
    const st = computeSellThrough(model)
    expect(st.totalSold).toBe(75)
    expect(st.sellThroughPercent).toBe(75)
  })
})

// ── TKT-2: Promo Code Validation ──────────────────────────────────────

describe('TKT-2: Promo code validation', () => {
  it('percentage discount computes correctly', () => {
    const promo = makePromo({ type: 'percentage', value: 20 })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(20)
    expect(result.error).toBeNull()
  })

  it('fixed amount discount capped at subtotal', () => {
    const promo = makePromo({ type: 'fixed_amount', value: 150 })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(100) // capped
  })

  it('fixed amount discount exact when under subtotal', () => {
    const promo = makePromo({ type: 'fixed_amount', value: 30 })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.discountAmount).toBe(30)
  })

  it('free ticket discount equals subtotal', () => {
    const promo = makePromo({ type: 'free_ticket', value: 0 })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(true)
    expect(result.discountAmount).toBe(100)
  })

  it('rejects inactive promo code', () => {
    const promo = makePromo({ isActive: false })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('inactive')
  })

  it('rejects expired promo code', () => {
    const promo = makePromo({ expiresAt: new Date('2025-01-01') })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('expired')
  })

  it('rejects when usage limit reached', () => {
    const promo = makePromo({ maxUses: 5, usedCount: 5 })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('usage limit')
  })

  it('rejects when tier not applicable', () => {
    const promo = makePromo({ applicableTiers: [TicketTier.VIP] })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('not valid for')
  })

  it('accepts when tier is in applicable list', () => {
    const promo = makePromo({ applicableTiers: [TicketTier.VIP, TicketTier.GENERAL] })
    const result = validatePromoCode(promo, 100, TicketTier.GENERAL, BASE_NOW)
    expect(result.valid).toBe(true)
  })

  it('empty applicableTiers means all tiers accepted', () => {
    const promo = makePromo({ applicableTiers: [] })
    const result = validatePromoCode(promo, 100, TicketTier.VVIP, BASE_NOW)
    expect(result.valid).toBe(true)
  })

  it('order total computation with discount', () => {
    const total = computeOrderTotal(
      [{ price: 50, quantity: 2 }, { price: 25, quantity: 1 }],
      20,
    )
    expect(total.subtotal).toBe(125)
    expect(total.discount).toBe(20)
    expect(total.total).toBe(105)
    expect(total.itemCount).toBe(3)
  })

  it('discount cannot exceed subtotal', () => {
    const total = computeOrderTotal([{ price: 10, quantity: 1 }], 50)
    expect(total.discount).toBe(10)
    expect(total.total).toBe(0)
  })
})

// ── TKT-3: Refund Eligibility ─────────────────────────────────────────

describe('TKT-3: Refund eligibility boundaries', () => {
  const eventStart = new Date('2025-06-20T20:00:00Z')

  it('>48h before event: full refund', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(49))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(true)
    expect(result.maxRefundAmount).toBe(200)
    expect(result.reason).toBeNull()
  })

  it('exactly 48h before event: 50% refund (boundary)', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(48))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(true)
    expect(result.maxRefundAmount).toBe(100) // 50%
    expect(result.reason).toContain('50%')
  })

  it('between 24-48h: 50% refund', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(36))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(true)
    expect(result.maxRefundAmount).toBe(100)
  })

  it('exactly 24h before event: no refund (boundary)', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(24))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(false)
    expect(result.maxRefundAmount).toBe(0)
    expect(result.reason).toContain('24h')
  })

  it('<24h before event: no refund', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(12))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(false)
  })

  it('after event started: no refund', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() + hours(1))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('already started')
  })

  it('event cancelled: full refund regardless of timing', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(1)) // <24h but cancelled
    const result = checkRefundEligibility(order, eventStart, 'cancelled', now)
    expect(result.eligible).toBe(true)
    expect(result.maxRefundAmount).toBe(200)
  })

  it('event postponed: full refund regardless of timing', () => {
    const order = makeOrder({ total: 200 })
    const now = new Date(eventStart.getTime() - hours(1))
    const result = checkRefundEligibility(order, eventStart, 'postponed', now)
    expect(result.eligible).toBe(true)
    expect(result.maxRefundAmount).toBe(200)
  })

  it('already refunded order: ineligible', () => {
    const order = makeOrder({ total: 200, status: 'refunded' })
    const now = new Date(eventStart.getTime() - hours(100))
    const result = checkRefundEligibility(order, eventStart, 'published', now)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('already refunded')
  })

  it('cancelled order: ineligible', () => {
    const order = makeOrder({ total: 200, status: 'cancelled' })
    const result = checkRefundEligibility(order, eventStart, 'published', BASE_NOW)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('cancelled')
  })
})

// ── TKT-4: Duplicate Scan Prevention ──────────────────────────────────

describe('TKT-4: Duplicate scan prevention', () => {
  it('first scan of valid ticket succeeds', () => {
    const holder = makeHolder({ eventId: 'evt-1' })
    const result = validateScan(holder.id, 'evt-1', null, holder, [], [])
    expect(result.result).toBe(ScanResult.VALID)
    expect(result.message).toContain('successful')
  })

  it('second scan of same ticket returns ALREADY_SCANNED', () => {
    const holder = makeHolder({ eventId: 'evt-1' })
    const existingScan = makeScan({ ticketId: holder.id, eventId: 'evt-1', result: ScanResult.VALID })
    const result = validateScan(holder.id, 'evt-1', null, holder, [existingScan], [])
    expect(result.result).toBe(ScanResult.ALREADY_SCANNED)
    expect(result.message).toContain('already scanned')
  })

  it('non-existent ticket returns INVALID', () => {
    const result = validateScan('nonexistent', 'evt-1', null, undefined, [], [])
    expect(result.result).toBe(ScanResult.INVALID)
    expect(result.holderId).toBeNull()
  })

  it('wrong event returns WRONG_EVENT', () => {
    const holder = makeHolder({ eventId: 'evt-2' })
    const result = validateScan(holder.id, 'evt-1', null, holder, [], [])
    expect(result.result).toBe(ScanResult.WRONG_EVENT)
  })

  it('cancelled ticket returns INVALID', () => {
    const holder = makeHolder({ eventId: 'evt-1', status: TicketStatus.CANCELLED })
    const result = validateScan(holder.id, 'evt-1', null, holder, [], [])
    expect(result.result).toBe(ScanResult.INVALID)
    expect(result.message).toContain('cancelled')
  })

  it('refunded ticket returns INVALID', () => {
    const holder = makeHolder({ eventId: 'evt-1', status: TicketStatus.REFUNDED })
    const result = validateScan(holder.id, 'evt-1', null, holder, [], [])
    expect(result.result).toBe(ScanResult.INVALID)
    expect(result.message).toContain('refunded')
  })

  it('session-gated event: valid session passes', () => {
    const holder = makeHolder({ eventId: 'evt-1' })
    const session = makeSession({ id: 'session-1', status: SessionStatus.LIVE })
    const result = validateScan(holder.id, 'evt-1', 'session-1', holder, [], [session])
    expect(result.result).toBe(ScanResult.VALID)
  })

  it('session-gated event: non-existent session fails', () => {
    const holder = makeHolder({ eventId: 'evt-1' })
    const result = validateScan(holder.id, 'evt-1', 'session-missing', holder, [], [])
    expect(result.result).toBe(ScanResult.WRONG_SESSION)
  })

  it('session-gated event: completed session rejects', () => {
    const holder = makeHolder({ eventId: 'evt-1' })
    const session = makeSession({ id: 'session-done', status: SessionStatus.COMPLETED })
    const result = validateScan(holder.id, 'evt-1', 'session-done', holder, [], [session])
    expect(result.result).toBe(ScanResult.EXPIRED)
  })

  it('stress: 500 unique tickets each scanned twice — zero double-admits', () => {
    const holders = Array.from({ length: 500 }, (_, i) =>
      makeHolder({ id: `stress-${i}`, eventId: 'evt-1' }),
    )
    const scans: TicketScan[] = []
    let doubleAdmits = 0

    for (const h of holders) {
      // First scan
      const r1 = validateScan(h.id, 'evt-1', null, h, scans, [])
      if (r1.result === ScanResult.VALID) {
        scans.push(makeScan({ ticketId: h.id, eventId: 'evt-1', result: ScanResult.VALID }))
      }
      // Second scan
      const r2 = validateScan(h.id, 'evt-1', null, h, scans, [])
      if (r2.result === ScanResult.VALID) {
        doubleAdmits++
      }
    }

    expect(doubleAdmits).toBe(0)
    expect(scans).toHaveLength(500)
  })

  it('check-in stats computation', () => {
    const holders = [
      makeHolder({ id: 'h1', tier: TicketTier.GENERAL }),
      makeHolder({ id: 'h2', tier: TicketTier.GENERAL }),
      makeHolder({ id: 'h3', tier: TicketTier.VIP }),
      makeHolder({ id: 'h4', tier: TicketTier.VIP, status: TicketStatus.CANCELLED }),
    ]
    const scans = [
      makeScan({ ticketId: 'h1', result: ScanResult.VALID }),
      makeScan({ ticketId: 'h3', result: ScanResult.VALID }),
    ]
    const stats = computeCheckInStats(holders, scans)
    expect(stats.totalTickets).toBe(3) // h4 cancelled, excluded
    expect(stats.checkedIn).toBe(2)
    expect(stats.checkInRate).toBeCloseTo(66.67, 1)
    expect(stats.byTier[TicketTier.GENERAL]).toEqual({ total: 2, checkedIn: 1 })
    expect(stats.byTier[TicketTier.VIP]).toEqual({ total: 1, checkedIn: 1 })
  })
})

// ── TKT-5: Offline Conflict Resolution ────────────────────────────────

describe('TKT-5: Offline conflict resolution (first-writer-wins)', () => {
  it('single scan per ticket has no conflict', () => {
    const records = [makeOfflineScan({ ticketId: 'tk-1', scannedAt: new Date('2025-06-15T10:00:00Z') })]
    const results = resolveOfflineConflicts(records)
    expect(results).toHaveLength(1)
    expect(results[0]!.hasConflict).toBe(false)
    expect(results[0]!.winner).toBeDefined()
  })

  it('two scans of same ticket: earliest wins', () => {
    const early = new Date('2025-06-15T10:00:00Z')
    const late = new Date('2025-06-15T10:05:00Z')
    const records = [
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: late, scannerDeviceId: 'device-B' }),
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: early, scannerDeviceId: 'device-A' }),
    ]
    const results = resolveOfflineConflicts(records)
    expect(results).toHaveLength(1)
    expect(results[0]!.hasConflict).toBe(true)
    expect(results[0]!.winner!.scannerDeviceId).toBe('device-A')
    expect(results[0]!.reason).toContain('2 scans detected')
  })

  it('three scans of same ticket: earliest still wins', () => {
    const t1 = new Date('2025-06-15T10:03:00Z')
    const t2 = new Date('2025-06-15T10:01:00Z')
    const t3 = new Date('2025-06-15T10:05:00Z')
    const records = [
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: t1, scannerDeviceId: 'dev-1' }),
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: t2, scannerDeviceId: 'dev-2' }),
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: t3, scannerDeviceId: 'dev-3' }),
    ]
    const results = resolveOfflineConflicts(records)
    expect(results[0]!.winner!.scannerDeviceId).toBe('dev-2')
    expect(results[0]!.reason).toContain('3 scans')
  })

  it('multiple tickets processed independently', () => {
    const records = [
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: new Date('2025-06-15T10:00:00Z'), scannerDeviceId: 'dev-1' }),
      makeOfflineScan({ ticketId: 'tk-2', scannedAt: new Date('2025-06-15T10:01:00Z'), scannerDeviceId: 'dev-1' }),
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: new Date('2025-06-15T10:02:00Z'), scannerDeviceId: 'dev-2' }),
    ]
    const results = resolveOfflineConflicts(records)
    expect(results).toHaveLength(2) // 2 unique tickets
    const tk1 = results.find(r => r.winner?.ticketId === 'tk-1')!
    const tk2 = results.find(r => r.winner?.ticketId === 'tk-2')!
    expect(tk1.hasConflict).toBe(true)
    expect(tk2.hasConflict).toBe(false)
  })

  it('buildOfflineCache keeps earliest scan per ticket', () => {
    const records = [
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: new Date('2025-06-15T10:05:00Z'), scannerDeviceId: 'late' }),
      makeOfflineScan({ ticketId: 'tk-1', scannedAt: new Date('2025-06-15T10:00:00Z'), scannerDeviceId: 'early' }),
      makeOfflineScan({ ticketId: 'tk-2', scannedAt: new Date('2025-06-15T10:03:00Z'), scannerDeviceId: 'only' }),
    ]
    const cache = buildOfflineCache(records)
    expect(cache.size).toBe(2)
    expect(cache.get('tk-1')!.scannerDeviceId).toBe('early')
    expect(cache.get('tk-2')!.scannerDeviceId).toBe('only')
  })

  it('stress: 200 tickets × 3 devices — all conflicts resolve deterministically', () => {
    const records: OfflineScanRecord[] = []
    for (let ticket = 0; ticket < 200; ticket++) {
      for (let device = 0; device < 3; device++) {
        records.push(makeOfflineScan({
          ticketId: `stress-tk-${ticket}`,
          scannedAt: new Date(BASE_NOW.getTime() + device * 1000 + Math.random() * 500),
          scannerDeviceId: `dev-${device}`,
        }))
      }
    }
    const results = resolveOfflineConflicts(records)
    expect(results).toHaveLength(200)
    for (const r of results) {
      expect(r.hasConflict).toBe(true)
      expect(r.winner).not.toBeNull()
    }
    // Run twice to prove determinism
    const results2 = resolveOfflineConflicts(records)
    for (let i = 0; i < results.length; i++) {
      expect(results[i]!.winner!.scannerDeviceId).toBe(results2[i]!.winner!.scannerDeviceId)
    }
  })
})

// ── TKT-6: Transfer Validation ────────────────────────────────────────

describe('TKT-6: Transfer validation', () => {
  it('CONFIRMED ticket with no prior transfers: allowed', () => {
    const holder = makeHolder({ id: 'tk-1', status: TicketStatus.CONFIRMED })
    const result = validateTransfer(holder, [])
    expect(result.allowed).toBe(true)
    expect(result.error).toBeNull()
  })

  it('non-CONFIRMED ticket: rejected', () => {
    for (const status of [TicketStatus.RESERVED, TicketStatus.CANCELLED, TicketStatus.REFUNDED, TicketStatus.TRANSFERRED, TicketStatus.EXPIRED] as const) {
      const holder = makeHolder({ id: 'tk-1', status })
      const result = validateTransfer(holder, [])
      expect(result.allowed).toBe(false)
      expect(result.error).toContain(status)
    }
  })

  it('max 3 transfers enforced (accepted count)', () => {
    const holder = makeHolder({ id: 'tk-1', status: TicketStatus.CONFIRMED })
    const transfers: TicketTransfer[] = [
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.ACCEPTED }),
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.ACCEPTED }),
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.ACCEPTED }),
    ]
    const result = validateTransfer(holder, transfers)
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('Maximum 3')
  })

  it('declined/expired/cancelled transfers do not count', () => {
    const holder = makeHolder({ id: 'tk-1', status: TicketStatus.CONFIRMED })
    const transfers: TicketTransfer[] = [
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.DECLINED }),
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.EXPIRED }),
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.CANCELLED }),
    ]
    const result = validateTransfer(holder, transfers)
    expect(result.allowed).toBe(true)
  })

  it('pending transfer blocks new transfer', () => {
    const holder = makeHolder({ id: 'tk-1', status: TicketStatus.CONFIRMED })
    const transfers: TicketTransfer[] = [
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.PENDING }),
    ]
    const result = validateTransfer(holder, transfers)
    expect(result.allowed).toBe(false)
    expect(result.error).toContain('pending transfer')
  })

  it('transfers for other tickets do not interfere', () => {
    const holder = makeHolder({ id: 'tk-1', status: TicketStatus.CONFIRMED })
    const transfers: TicketTransfer[] = [
      makeTransfer({ ticketId: 'tk-other', status: TransferStatus.ACCEPTED }),
      makeTransfer({ ticketId: 'tk-other', status: TransferStatus.ACCEPTED }),
      makeTransfer({ ticketId: 'tk-other', status: TransferStatus.ACCEPTED }),
    ]
    const result = validateTransfer(holder, transfers)
    expect(result.allowed).toBe(true)
  })

  it('custom maxTransfersPerTicket respected', () => {
    const holder = makeHolder({ id: 'tk-1', status: TicketStatus.CONFIRMED })
    const transfers: TicketTransfer[] = [
      makeTransfer({ ticketId: 'tk-1', status: TransferStatus.ACCEPTED }),
    ]
    const result = validateTransfer(holder, transfers, 1)
    expect(result.allowed).toBe(false)
  })
})

// ── TKT-7: Event Settlement ──────────────────────────────────────────

describe('TKT-7: Event settlement', () => {
  it('completed event with no blockers is ready for settlement', () => {
    const event = makeEvent({ status: EventStatus.COMPLETED })
    const result = checkSettlementReadiness(event, 0, 0)
    expect(result.ready).toBe(true)
    expect(result.blockers).toHaveLength(0)
  })

  it('cancelled event is ready for settlement', () => {
    const event = makeEvent({ status: EventStatus.CANCELLED })
    const result = checkSettlementReadiness(event, 0, 0)
    expect(result.ready).toBe(true)
  })

  it('in-progress event is not ready', () => {
    const event = makeEvent({ status: EventStatus.IN_PROGRESS })
    const result = checkSettlementReadiness(event, 0, 0)
    expect(result.ready).toBe(false)
    expect(result.blockers.some(b => b.includes('in_progress'))).toBe(true)
  })

  it('pending refunds block settlement', () => {
    const event = makeEvent({ status: EventStatus.COMPLETED })
    const result = checkSettlementReadiness(event, 3, 0)
    expect(result.ready).toBe(false)
    expect(result.blockers.some(b => b.includes('3 refund'))).toBe(true)
  })

  it('pending transfers block settlement', () => {
    const event = makeEvent({ status: EventStatus.COMPLETED })
    const result = checkSettlementReadiness(event, 0, 2)
    expect(result.ready).toBe(false)
    expect(result.blockers.some(b => b.includes('2 ticket transfer'))).toBe(true)
  })

  it('multiple blockers reported together', () => {
    const event = makeEvent({ status: EventStatus.PUBLISHED })
    const result = checkSettlementReadiness(event, 1, 1)
    expect(result.ready).toBe(false)
    expect(result.blockers.length).toBeGreaterThanOrEqual(3)
  })

  it('computeEventRevenue filters to confirmed orders', () => {
    const orders = [
      makeOrder({ total: 100, status: 'confirmed' }),
      makeOrder({ total: 50, status: 'confirmed' }),
      makeOrder({ total: 75, status: 'pending' }), // excluded
      makeOrder({ total: 25, status: 'failed' }), // excluded
    ]
    const breakdown = computeEventRevenue('evt-1', orders, [10])
    expect(breakdown.ticketRevenue).toBe(150) // only confirmed
    expect(breakdown.orderCount).toBe(2)
    expect(breakdown.refundTotal).toBe(10)
    expect(breakdown.netRevenue).toBe(140)
  })

  it('DEFAULT_EVENT_SPLITS sum to 100%', () => {
    const total = DEFAULT_EVENT_SPLITS.reduce((sum, s) => sum + s.sharePercent, 0)
    expect(total).toBe(100)
  })

  it('platform/promoter/artist split ratio is 10/30/60', () => {
    const platform = DEFAULT_EVENT_SPLITS.find(s => s.recipientName === 'Platform')
    const promoter = DEFAULT_EVENT_SPLITS.find(s => s.recipientName === 'Promoter')
    const artist = DEFAULT_EVENT_SPLITS.find(s => s.recipientName === 'Artist(s)')
    expect(platform?.sharePercent).toBe(10)
    expect(promoter?.sharePercent).toBe(30)
    expect(artist?.sharePercent).toBe(60)
  })

  it('buildEventSettlement produces correct structure', () => {
    const orders = [makeOrder({ total: 1000, status: 'confirmed' })]
    const breakdown = computeEventRevenue('evt-1', orders, [])
    const settlement = buildEventSettlement(breakdown, 'artist-1', 'promoter-1')
    expect(settlement.eventId).toBe('evt-1')
    expect(settlement.grossTicketSales).toBe(1000)
    expect(settlement.totalRefunds).toBe(0)
    expect(settlement.currency).toBe('USD')
    // Artist 60% + Promoter 30% + Platform 10% + fees ≈ net revenue
    expect(settlement.artistShares[0]!.artistId).toBe('artist-1')
    expect(settlement.netRevenue).toBe(1000)
  })

  it('settlement sums (artist + promoter + platform + fees) equal net revenue', () => {
    const orders = [makeOrder({ total: 5000, status: 'confirmed' })]
    const breakdown = computeEventRevenue('evt-1', orders, [200])
    const settlement = buildEventSettlement(breakdown, 'artist-1', 'promoter-1')
    const sumDistributed = settlement.artistShares.reduce((s, a) => s + a.amount, 0) +
      settlement.promoterShare + settlement.platformFees
    // sumDistributed should account for net revenue (ticket - refunds)
    // platformFees includes both platform split and fee deductions
    expect(settlement.netRevenue).toBe(4800)
    expect(sumDistributed).toBeGreaterThan(0)
    // After fees & splits, total distributed should approximate net revenue
    expect(Math.abs(sumDistributed - settlement.netRevenue)).toBeLessThan(1)
  })

  it('zero-revenue event produces zero settlement', () => {
    const orders: TicketOrder[] = []
    const breakdown = computeEventRevenue('evt-1', orders, [])
    expect(breakdown.ticketRevenue).toBe(0)
    expect(breakdown.netRevenue).toBe(0)
    expect(breakdown.orderCount).toBe(0)
  })
})
