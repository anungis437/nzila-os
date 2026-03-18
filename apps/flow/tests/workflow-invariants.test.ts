/**
 * Flow — Workflow State Machine Invariant Tests
 *
 * Verifies that every state machine:
 *  1. Rejects all illegal transitions
 *  2. Accepts all defined transitions
 *  3. Exposes correct available transitions for each status
 *  4. Never returns a silent failure (attempt result matches validate)
 */
import { describe, it, expect } from 'vitest'

// ── Order Workflow ─────────────────────────────────────────────────────────
import {
  validateOrderTransition,
  attemptOrderTransition,
  applyOrderTransition,
  getAvailableOrderTransitions,
  getAllOrderStatuses,
} from '@/lib/workflows/order-workflow'

// ── PO Workflow ────────────────────────────────────────────────────────────
import {
  validatePOTransition,
  attemptPOTransition,
  getAvailablePOTransitions,
} from '@/lib/workflows/po-workflow'

// ── Production Workflow ────────────────────────────────────────────────────
import {
  validateProductionTransition,
  attemptProductionTransition,
  getAvailableProductionTransitions,
} from '@/lib/workflows/production-workflow'

// ── Shipment Workflow ──────────────────────────────────────────────────────
import {
  validateShipmentTransition,
  attemptShipmentTransition,
  getAvailableShipmentTransitions,
} from '@/lib/workflows/shipment-state-machine'

// ── Quote Workflow ─────────────────────────────────────────────────────────
import {
  attemptQuoteTransition,
  isQuoteTransitionAllowed,
  getAvailableQuoteTransitions,
  getAllQuoteStatuses,
} from '@/lib/workflows/quote-state-machine'

import { InvalidTransitionError } from '@/lib/workflows/types'
import type { OrderStatus, PurchaseOrderStatus, ShipmentStatus, ProductionJobStatus } from '@/domain/entities'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate all (from, to) pairs that are NOT in the transition table.
 */
function illegalPairs<S extends string>(
  allStatuses: readonly S[],
  isAllowed: (from: S, to: S) => boolean,
): [S, S][] {
  const pairs: [S, S][] = []
  for (const from of allStatuses) {
    for (const to of allStatuses) {
      if (from === to) continue // self-transition always skipped
      if (!isAllowed(from, to)) pairs.push([from, to])
    }
  }
  return pairs
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDER
// ═══════════════════════════════════════════════════════════════════════════
describe('Order Workflow SM', () => {
  const allStatuses = getAllOrderStatuses()

  it('should accept all defined transitions', () => {
    const defined: [OrderStatus, OrderStatus][] = [
      ['CREATED', 'CONFIRMED'],
      ['CREATED', 'CANCELLED'],
      ['CONFIRMED', 'DEPOSIT_REQUIRED'],
      ['CONFIRMED', 'PAYMENT_COMPLETE'],
      ['CONFIRMED', 'CANCELLED'],
      ['DEPOSIT_REQUIRED', 'PAYMENT_PARTIAL'],
      ['DEPOSIT_REQUIRED', 'CANCELLED'],
      ['PAYMENT_PARTIAL', 'PAYMENT_COMPLETE'],
      ['PAYMENT_COMPLETE', 'READY_FOR_PROCUREMENT'],
      ['READY_FOR_PROCUREMENT', 'IN_PRODUCTION'],
      ['IN_PRODUCTION', 'READY_TO_SHIP'],
      ['READY_TO_SHIP', 'SHIPPED'],
      ['SHIPPED', 'DELIVERED'],
      ['DELIVERED', 'CLOSED'],
    ]

    for (const [from, to] of defined) {
      expect(validateOrderTransition(from, to), `${from} → ${to}`).toBe(true)
      const result = attemptOrderTransition(from, to)
      expect(result.ok, `attempt ${from} → ${to}`).toBe(true)
      expect(applyOrderTransition(from, to)).toBe(to)
    }
  })

  it('should reject all illegal transitions', () => {
    const illegal = illegalPairs(allStatuses, validateOrderTransition)
    expect(illegal.length).toBeGreaterThan(0)

    for (const [from, to] of illegal) {
      const result = attemptOrderTransition(from, to)
      expect(result.ok, `should reject ${from} → ${to}`).toBe(false)
      expect(() => applyOrderTransition(from, to)).toThrow(InvalidTransitionError)
    }
  })

  it('should expose correct available transitions', () => {
    const available = getAvailableOrderTransitions('CREATED')
    const targets = available.map((t) => t.to)
    expect(targets).toContain('CONFIRMED')
    expect(targets).toContain('CANCELLED')
    expect(targets).not.toContain('SHIPPED')
  })

  it('should have no self-transitions', () => {
    for (const s of allStatuses) {
      expect(validateOrderTransition(s, s), `self ${s}`).toBe(false)
    }
  })

  it('terminal states should have no outgoing transitions', () => {
    for (const terminal of ['CLOSED', 'CANCELLED'] as OrderStatus[]) {
      const available = getAvailableOrderTransitions(terminal)
      expect(available, `terminal ${terminal}`).toHaveLength(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER
// ═══════════════════════════════════════════════════════════════════════════
describe('PO Workflow SM', () => {
  const allStatuses: PurchaseOrderStatus[] = [
    'DRAFT', 'SENT', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'RECEIVED', 'CANCELLED',
  ]

  it('should accept all defined transitions', () => {
    const defined: [PurchaseOrderStatus, PurchaseOrderStatus][] = [
      ['DRAFT', 'SENT'],
      ['DRAFT', 'CANCELLED'],
      ['SENT', 'CONFIRMED'],
      ['SENT', 'DRAFT'],
      ['SENT', 'CANCELLED'],
      ['CONFIRMED', 'IN_PRODUCTION'],
      ['CONFIRMED', 'CANCELLED'],
      ['IN_PRODUCTION', 'SHIPPED'],
      ['IN_PRODUCTION', 'CANCELLED'],
      ['SHIPPED', 'RECEIVED'],
    ]

    for (const [from, to] of defined) {
      expect(validatePOTransition(from, to), `${from} → ${to}`).toBe(true)
      const result = attemptPOTransition(from, to)
      expect(result.ok, `attempt ${from} → ${to}`).toBe(true)
    }
  })

  it('should reject all illegal transitions', () => {
    const illegal = illegalPairs(allStatuses, validatePOTransition)
    expect(illegal.length).toBeGreaterThan(0)

    for (const [from, to] of illegal) {
      const result = attemptPOTransition(from, to)
      expect(result.ok, `should reject ${from} → ${to}`).toBe(false)
    }
  })

  it('terminal states should have no outgoing transitions', () => {
    for (const terminal of ['RECEIVED', 'CANCELLED'] as PurchaseOrderStatus[]) {
      const available = getAvailablePOTransitions(terminal)
      expect(available, `terminal ${terminal}`).toHaveLength(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// SHIPMENT
// ═══════════════════════════════════════════════════════════════════════════
describe('Shipment Workflow SM', () => {
  const allStatuses: ShipmentStatus[] = [
    'PENDING', 'PACKED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED',
  ]

  it('should accept all defined transitions', () => {
    const defined: [ShipmentStatus, ShipmentStatus][] = [
      ['PENDING', 'PACKED'],
      ['PENDING', 'SHIPPED'],
      ['PACKED', 'SHIPPED'],
      ['SHIPPED', 'IN_TRANSIT'],
      ['IN_TRANSIT', 'DELIVERED'],
      ['IN_TRANSIT', 'FAILED'],
      ['FAILED', 'PENDING'],
      ['FAILED', 'RETURNED'],
    ]

    for (const [from, to] of defined) {
      expect(validateShipmentTransition(from, to), `${from} → ${to}`).toBe(true)
      const result = attemptShipmentTransition(from, to)
      expect(result.ok, `attempt ${from} → ${to}`).toBe(true)
    }
  })

  it('should reject all illegal transitions', () => {
    const illegal = illegalPairs(allStatuses, validateShipmentTransition)
    expect(illegal.length).toBeGreaterThan(0)

    for (const [from, to] of illegal) {
      const result = attemptShipmentTransition(from, to)
      expect(result.ok, `should reject ${from} → ${to}`).toBe(false)
    }
  })

  it('terminal states should have no outgoing transitions', () => {
    for (const terminal of ['DELIVERED', 'RETURNED'] as ShipmentStatus[]) {
      const available = getAvailableShipmentTransitions(terminal)
      expect(available, `terminal ${terminal}`).toHaveLength(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTION
// ═══════════════════════════════════════════════════════════════════════════
describe('Production Workflow SM', () => {
  const allStatuses: ProductionJobStatus[] = [
    'PENDING_PROOF', 'PROOF_SENT', 'PROOF_APPROVED',
    'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP',
  ]

  it('should accept all defined transitions', () => {
    const defined: [ProductionJobStatus, ProductionJobStatus][] = [
      ['PENDING_PROOF', 'PROOF_SENT'],
      ['PROOF_SENT', 'PROOF_APPROVED'],
      ['PROOF_APPROVED', 'IN_PRODUCTION'],
      ['IN_PRODUCTION', 'QUALITY_CHECK'],
      ['QUALITY_CHECK', 'READY_TO_SHIP'],
      ['QUALITY_CHECK', 'IN_PRODUCTION'], // QC fail loop
    ]

    for (const [from, to] of defined) {
      expect(validateProductionTransition(from, to), `${from} → ${to}`).toBe(true)
      const result = attemptProductionTransition(from, to)
      expect(result.ok, `attempt ${from} → ${to}`).toBe(true)
    }
  })

  it('should reject all illegal transitions', () => {
    const illegal = illegalPairs(allStatuses, validateProductionTransition)
    expect(illegal.length).toBeGreaterThan(0)

    for (const [from, to] of illegal) {
      const result = attemptProductionTransition(from, to)
      expect(result.ok, `should reject ${from} → ${to}`).toBe(false)
    }
  })

  it('READY_TO_SHIP is terminal for production', () => {
    const available = getAvailableProductionTransitions('READY_TO_SHIP')
    expect(available).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// QUOTE
// ═══════════════════════════════════════════════════════════════════════════
describe('Quote Workflow SM', () => {
  const _allStatuses = getAllQuoteStatuses()

  it('should accept all key transitions', () => {
    const defined = [
      ['DRAFT', 'INTERNAL_REVIEW'],
      ['INTERNAL_REVIEW', 'SENT_TO_CLIENT'],
      ['SENT_TO_CLIENT', 'ACCEPTED'],
      ['ACCEPTED', 'DEPOSIT_REQUIRED'],
      ['ACCEPTED', 'READY_FOR_PO'],
      ['DEPOSIT_REQUIRED', 'READY_FOR_PO'],
      ['READY_FOR_PO', 'IN_PRODUCTION'],
      ['IN_PRODUCTION', 'SHIPPED'],
      ['SHIPPED', 'DELIVERED'],
      ['DELIVERED', 'CLOSED'],
    ] as const

    for (const [from, to] of defined) {
      expect(isQuoteTransitionAllowed(from, to), `${from} → ${to}`).toBe(true)
      const result = attemptQuoteTransition(from, to)
      expect(result.ok, `attempt ${from} → ${to}`).toBe(true)
    }
  })

  it('should reject illegal transitions', () => {
    expect(isQuoteTransitionAllowed('CLOSED', 'DRAFT')).toBe(false)
    expect(isQuoteTransitionAllowed('CANCELLED', 'DRAFT')).toBe(false)
    expect(isQuoteTransitionAllowed('DRAFT', 'CLOSED')).toBe(false)
    expect(isQuoteTransitionAllowed('ACCEPTED', 'IN_PRODUCTION')).toBe(false)
  })

  it('terminal states should have no outgoing transitions', () => {
    for (const terminal of ['CLOSED', 'CANCELLED', 'EXPIRED'] as const) {
      const available = getAvailableQuoteTransitions(terminal)
      expect(available, `terminal ${terminal}`).toHaveLength(0)
    }
  })
})
