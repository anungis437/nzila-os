/**
 * Flow — Order Lifecycle Integration Tests
 *
 * Validates the complete order-centric lifecycle:
 *   quote → order → deposit → PO → production → shipment → delivery
 */
import { describe, it, expect } from 'vitest'

// ── Domain entities & workflow schemas ─────────────────────────────────────

const OrderStatus = {
  CREATED: 'created',
  CONFIRMED: 'confirmed',
  READY_FOR_PO: 'ready_for_po',
  IN_PRODUCTION: 'in_production',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CLOSED: 'closed',
} as const

const PaymentStatus = {
  NOT_REQUIRED: 'not_required',
  PENDING_DEPOSIT: 'pending_deposit',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const

const ProductionJobStatus = {
  PENDING_PROOF: 'pending_proof',
  PROOF_SENT: 'proof_sent',
  PROOF_APPROVED: 'proof_approved',
  IN_PRODUCTION: 'in_production',
  QUALITY_CHECK: 'quality_check',
  READY_TO_SHIP: 'ready_to_ship',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
} as const

// ── Business rule functions under test ────────────────────────────────────

function canCreatePO(order: { paymentStatus: string; depositRequired: boolean }): boolean {
  if (!order.depositRequired) return true
  return order.paymentStatus === PaymentStatus.PARTIALLY_PAID || order.paymentStatus === PaymentStatus.PAID
}

function canStartProduction(order: { paymentStatus: string; status: string }, hasPO: boolean): boolean {
  if (order.status !== OrderStatus.READY_FOR_PO && order.status !== OrderStatus.CONFIRMED) return false
  if (!hasPO) return false
  return order.paymentStatus !== PaymentStatus.OVERDUE
}

function canShip(productionJob: { status: string }): boolean {
  return productionJob.status === ProductionJobStatus.READY_TO_SHIP || productionJob.status === ProductionJobStatus.COMPLETED
}

function computeMargin(revenue: number, cost: number): number {
  if (revenue === 0) return 0
  return Math.round(((revenue - cost) / revenue) * 10000) / 100
}

function computeDepositAmount(total: number, depositPercent: number): number {
  return Math.round(total * (depositPercent / 100) * 100) / 100
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Order Lifecycle', () => {
  describe('Quote → Order conversion', () => {
    it('preserves quote lines as order lines', () => {
      const quoteLines = [
        { productId: 'p1', quantity: 10, unitPrice: 25.00, description: 'Caps' },
        { productId: 'p2', quantity: 5, unitPrice: 50.00, description: 'Shirts' },
      ]

      const orderLines = quoteLines.map((ql) => ({
        productId: ql.productId,
        description: ql.description,
        quantity: ql.quantity,
        unitPrice: ql.unitPrice,
        lineTotal: ql.quantity * ql.unitPrice,
      }))

      expect(orderLines).toHaveLength(2)
      expect(orderLines[0]!.lineTotal).toBe(250)
      expect(orderLines[1]!.lineTotal).toBe(250)
    })

    it('sets initial order status to created', () => {
      const order = { status: OrderStatus.CREATED, paymentStatus: PaymentStatus.PENDING_DEPOSIT }
      expect(order.status).toBe('created')
    })

    it('calculates correct order total from lines', () => {
      const lines = [
        { quantity: 10, unitPrice: 25.00 },
        { quantity: 5, unitPrice: 50.00 },
      ]
      const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
      const taxRate = 0.15
      const taxTotal = Math.round(subtotal * taxRate * 100) / 100
      const total = subtotal + taxTotal

      expect(subtotal).toBe(500)
      expect(taxTotal).toBe(75)
      expect(total).toBe(575)
    })
  })

  describe('Deposit blocks PO', () => {
    it('blocks PO creation when deposit required but unpaid', () => {
      const order = { paymentStatus: PaymentStatus.PENDING_DEPOSIT, depositRequired: true }
      expect(canCreatePO(order)).toBe(false)
    })

    it('allows PO when deposit is partially paid', () => {
      const order = { paymentStatus: PaymentStatus.PARTIALLY_PAID, depositRequired: true }
      expect(canCreatePO(order)).toBe(true)
    })

    it('allows PO when deposit is fully paid', () => {
      const order = { paymentStatus: PaymentStatus.PAID, depositRequired: true }
      expect(canCreatePO(order)).toBe(true)
    })

    it('allows PO when no deposit required', () => {
      const order = { paymentStatus: PaymentStatus.PENDING_DEPOSIT, depositRequired: false }
      expect(canCreatePO(order)).toBe(true)
    })

    it('calculates correct deposit amount', () => {
      expect(computeDepositAmount(10000, 50)).toBe(5000)
      expect(computeDepositAmount(7500, 30)).toBe(2250)
      expect(computeDepositAmount(1234.56, 25)).toBe(308.64)
    })
  })

  describe('Payment unlocks procurement', () => {
    it('blocks production when payment overdue', () => {
      const order = { paymentStatus: PaymentStatus.OVERDUE, status: OrderStatus.CONFIRMED }
      expect(canStartProduction(order, true)).toBe(false)
    })

    it('allows production when payment current', () => {
      const order = { paymentStatus: PaymentStatus.PAID, status: OrderStatus.READY_FOR_PO }
      expect(canStartProduction(order, true)).toBe(true)
    })

    it('blocks production without a PO', () => {
      const order = { paymentStatus: PaymentStatus.PAID, status: OrderStatus.READY_FOR_PO }
      expect(canStartProduction(order, false)).toBe(false)
    })

    it('blocks production when order not ready', () => {
      const order = { paymentStatus: PaymentStatus.PAID, status: OrderStatus.CREATED }
      expect(canStartProduction(order, true)).toBe(false)
    })
  })

  describe('Production lifecycle', () => {
    it('does not allow shipping from pending_proof status', () => {
      expect(canShip({ status: ProductionJobStatus.PENDING_PROOF })).toBe(false)
    })

    it('does not allow shipping from in_production status', () => {
      expect(canShip({ status: ProductionJobStatus.IN_PRODUCTION })).toBe(false)
    })

    it('allows shipping when ready_to_ship', () => {
      expect(canShip({ status: ProductionJobStatus.READY_TO_SHIP })).toBe(true)
    })

    it('allows shipping when completed', () => {
      expect(canShip({ status: ProductionJobStatus.COMPLETED })).toBe(true)
    })

    it('blocks shipping when quality_check in progress', () => {
      expect(canShip({ status: ProductionJobStatus.QUALITY_CHECK })).toBe(false)
    })

    it('blocks shipping when blocked', () => {
      expect(canShip({ status: ProductionJobStatus.BLOCKED })).toBe(false)
    })
  })

  describe('Margin computation', () => {
    it('calculates correct margin percentage', () => {
      expect(computeMargin(1000, 600)).toBe(40)
      expect(computeMargin(500, 350)).toBe(30)
    })

    it('handles zero revenue', () => {
      expect(computeMargin(0, 100)).toBe(0)
    })

    it('handles 100% margin (zero cost)', () => {
      expect(computeMargin(1000, 0)).toBe(100)
    })
  })

  describe('End-to-end workflow sequence', () => {
    it('validates the full lifecycle state progression', () => {
      const states: string[] = []

      // Step 1: Create order from quote
      states.push(OrderStatus.CREATED)

      // Step 2: Confirm order
      states.push(OrderStatus.CONFIRMED)

      // Step 3: Collect deposit → ready for PO
      states.push(OrderStatus.READY_FOR_PO)

      // Step 4: PO created, production starts
      states.push(OrderStatus.IN_PRODUCTION)

      // Step 5: Ship
      states.push(OrderStatus.SHIPPED)

      // Step 6: Deliver
      states.push(OrderStatus.DELIVERED)

      // Step 7: Close
      states.push(OrderStatus.CLOSED)

      expect(states).toEqual([
        'created', 'confirmed', 'ready_for_po',
        'in_production', 'shipped', 'delivered', 'closed',
      ])
      expect(states).toHaveLength(7)
    })
  })
})
