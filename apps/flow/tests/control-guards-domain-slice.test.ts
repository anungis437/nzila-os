import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockQuoteRepo,
  mockOrderRepo,
  mockCustomerRepo,
  mockVendorRepo,
  mockPurchaseOrderRepo,
  mockProductionRepo,
  mockPaymentRepo,
  mockPaymentRequirementRepo,
  mockFindShipmentsByOrder,
  mockCanGeneratePO,
  mockCanStartProduction,
  mockCanShipOrder,
} = vi.hoisted(() => ({
  mockQuoteRepo: { findById: vi.fn() },
  mockOrderRepo: { findById: vi.fn() },
  mockCustomerRepo: { findById: vi.fn() },
  mockVendorRepo: { findById: vi.fn() },
  mockPurchaseOrderRepo: { findById: vi.fn() },
  mockProductionRepo: { findById: vi.fn(), findByOrder: vi.fn() },
  mockPaymentRepo: { totalPaidForOrder: vi.fn() },
  mockPaymentRequirementRepo: { findByQuoteId: vi.fn() },
  mockFindShipmentsByOrder: vi.fn(),
  mockCanGeneratePO: vi.fn(),
  mockCanStartProduction: vi.fn(),
  mockCanShipOrder: vi.fn(),
}))

vi.mock('@/lib/repositories', () => ({
  quoteRepo: mockQuoteRepo,
  orderRepo: mockOrderRepo,
  customerRepo: mockCustomerRepo,
  vendorRepo: mockVendorRepo,
  purchaseOrderRepo: mockPurchaseOrderRepo,
  productionRepo: mockProductionRepo,
  paymentRepo: mockPaymentRepo,
}))

vi.mock('@/lib/repositories/workflow-repository', () => ({
  paymentRequirementRepo: mockPaymentRequirementRepo,
}))

vi.mock('@/lib/services/order-payment-gating', () => ({
  canGeneratePO: mockCanGeneratePO,
  canStartProduction: mockCanStartProduction,
  canShipOrder: mockCanShipOrder,
}))

vi.mock('@/lib/services/shipment-service', () => ({
  findShipmentsByOrder: mockFindShipmentsByOrder,
}))

import {
  checkCanGeneratePO,
  checkCanShipOrder,
  checkCanStartProduction,
  explainPaymentBlock,
} from '@/lib/control/guards/payment-guard'
import {
  checkProductionReadiness,
} from '@/lib/control/guards/production-guard'
import {
  checkCanMarkDelivered,
  checkCanMarkShipped,
  checkShipmentReadiness,
} from '@/lib/control/guards/shipment-guard'
import {
  checkEntityExists,
  checkOrderInvariants,
  checkProductionJobInvariants,
  checkPurchaseOrderInvariants,
  checkQuoteInvariants,
} from '@/lib/control/guards/invariant-guard'

describe('Flow control guards domain slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockCanGeneratePO.mockReturnValue({ allowed: true, blockers: [] })
    mockCanStartProduction.mockReturnValue({ allowed: true, blockers: [] })
    mockCanShipOrder.mockReturnValue({ allowed: true, blockers: [] })
  })

  describe('payment-guard', () => {
    it('blocks when order is not found', async () => {
      mockOrderRepo.findById.mockResolvedValue(null)

      const result = await checkCanGeneratePO('ord-1', 'org-1')

      expect(result.allowed).toBe(false)
      expect(result.reasons[0]).toContain('not found')
      expect(result.snapshot.order_id).toBe('ord-1')
    })

    it('returns allowed gate check using loaded payment context', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 'ord-1',
        total: 500,
        paymentStatus: 'PAID',
        status: 'confirmed',
        quoteId: 'q-1',
      })
      mockPaymentRepo.totalPaidForOrder.mockResolvedValue(500)
      mockPaymentRequirementRepo.findByQuoteId.mockResolvedValue({
        depositRequired: true,
        depositPercent: 50,
        depositAmount: null,
        dueBeforeProduction: true,
      })
      mockCanGeneratePO.mockReturnValue({ allowed: true, blockers: [] })

      const result = await checkCanGeneratePO('ord-1', 'org-1')

      expect(result.allowed).toBe(true)
      expect(result.gate_state).toBe('clear')
      expect(result.snapshot.amount_paid).toBe(500)
      expect(result.snapshot.deposit_required).toBe(true)
    })

    it('returns blocked result with required actions', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 'ord-1',
        total: 500,
        paymentStatus: 'PENDING',
        status: 'confirmed',
        quoteId: null,
      })
      mockPaymentRepo.totalPaidForOrder.mockResolvedValue(100)
      mockCanStartProduction.mockReturnValue({
        allowed: false,
        blockers: ['Deposit missing'],
      })

      const result = await checkCanStartProduction('ord-1', 'org-1')

      expect(result.allowed).toBe(false)
      expect(result.reasons).toEqual(['Deposit missing'])
      expect(result.required_actions[0]).toContain('Resolve')
    })

    it('explains combined blockers across PO/production/shipment gates', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 'ord-1',
        total: 500,
        paymentStatus: 'PENDING',
        status: 'confirmed',
        quoteId: null,
      })
      mockPaymentRepo.totalPaidForOrder.mockResolvedValue(100)
      mockCanGeneratePO.mockReturnValue({ allowed: false, blockers: ['PO blocked'] })
      mockCanStartProduction.mockReturnValue({ allowed: false, blockers: ['Prod blocked'] })
      mockCanShipOrder.mockReturnValue({ allowed: false, blockers: ['Ship blocked'] })

      const result = await explainPaymentBlock('ord-1', 'org-1')

      expect(result.blocked).toBe(true)
      expect(result.explanation).toContain('[PO] PO blocked')
      expect(result.explanation).toContain('[Production] Prod blocked')
      expect(result.explanation).toContain('[Shipment] Ship blocked')
    })

    it('returns clear explanation when no blockers exist', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 'ord-1',
        total: 500,
        paymentStatus: 'PAID',
        status: 'confirmed',
        quoteId: null,
      })
      mockPaymentRepo.totalPaidForOrder.mockResolvedValue(500)

      const result = await explainPaymentBlock('ord-1', 'org-1')

      expect(result.blocked).toBe(false)
      expect(result.explanation[0]).toContain('No payment blocks')
    })

    it('blocks ship-order check when order is missing', async () => {
      mockOrderRepo.findById.mockResolvedValue(null)

      const result = await checkCanShipOrder('ord-x', 'org-1')

      expect(result.allowed).toBe(false)
      expect(result.reasons[0]).toContain('not found')
    })
  })

  describe('production-guard', () => {
    it('passes when all production prerequisites are met', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 'ord-1', status: 'confirmed' })
      mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', status: 'acknowledged' })
      mockVendorRepo.findById.mockResolvedValue({ id: 'v-1', name: 'Vendor', status: 'active' })
      mockCanStartProduction.mockReturnValue({ allowed: true, blockers: [] })

      const result = await checkProductionReadiness('ord-1', 'po-1', 'v-1', 'org-1')

      expect(result.allowed).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.po_valid).toBe(true)
      expect(result.payment_cleared).toBe(true)
      expect(result.vendor_assigned).toBe(true)
    })

    it('collects blockers for missing/invalid dependencies', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 'ord-1', status: 'draft' })
      mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', status: 'sent' })
      mockVendorRepo.findById.mockResolvedValue({ id: 'v-1', name: 'Vendor', status: 'inactive' })
      mockCanStartProduction.mockReturnValue({ allowed: false, blockers: ['Payment missing'] })

      const result = await checkProductionReadiness('ord-1', 'po-1', 'v-1', 'org-1')

      expect(result.allowed).toBe(false)
      expect(result.blockers).toContain('Order status "draft" does not allow production start')
      expect(result.blockers).toContain('PO status "sent" does not allow production — must be acknowledged')
      expect(result.blockers).toContain('Payment missing')
      expect(result.blockers).toContain('Vendor "Vendor" is inactive')
    })
  })

  describe('shipment-guard', () => {
    it('blocks readiness when order does not exist', async () => {
      mockOrderRepo.findById.mockResolvedValue(null)

      const result = await checkShipmentReadiness('ord-1', 'org-1')

      expect(result.allowed).toBe(false)
      expect(result.blockers[0]).toContain('not found')
    })

    it('blocks readiness when no jobs are ready and no customer is assigned', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 'ord-1', customerId: null })
      mockProductionRepo.findByOrder.mockResolvedValue([{ status: 'queued' }])

      const result = await checkShipmentReadiness('ord-1', 'org-1')

      expect(result.allowed).toBe(false)
      expect(result.blockers).toContain('No production jobs are ready for shipment')
      expect(result.blockers).toContain('No customer assigned — cannot determine shipping address')
    })

    it('passes readiness when production is ready and customer exists', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 'ord-1', customerId: 'c-1' })
      mockProductionRepo.findByOrder.mockResolvedValue([{ status: 'ready_to_ship' }])

      const result = await checkShipmentReadiness('ord-1', 'org-1')

      expect(result.allowed).toBe(true)
      expect(result.production_complete).toBe(true)
      expect(result.shipping_address_exists).toBe(true)
    })

    it('checkCanMarkShipped blocks missing shipment and invalid status', async () => {
      mockFindShipmentsByOrder.mockResolvedValue([{ id: 's-1', status: 'delivered' }])

      const missing = await checkCanMarkShipped('missing', 'ord-1', 'org-1')
      const invalid = await checkCanMarkShipped('s-1', 'ord-1', 'org-1')

      expect(missing.allowed).toBe(false)
      expect(missing.blockers[0]).toContain('not found')
      expect(invalid.allowed).toBe(false)
      expect(invalid.blockers[0]).toContain('cannot transition to shipped')
    })

    it('checkCanMarkDelivered allows in_transit and blocks pending', async () => {
      mockFindShipmentsByOrder.mockResolvedValue([
        { id: 's-ok', status: 'in_transit' },
        { id: 's-bad', status: 'pending' },
      ])

      const allowed = await checkCanMarkDelivered('s-ok', 'ord-1', 'org-1')
      const blocked = await checkCanMarkDelivered('s-bad', 'ord-1', 'org-1')

      expect(allowed.allowed).toBe(true)
      expect(blocked.allowed).toBe(false)
      expect(blocked.blockers[0]).toContain('cannot transition to delivered')
    })
  })

  describe('invariant-guard', () => {
    it('flags unknown entity type and missing entities', async () => {
      const unknown = await checkEntityExists('unknown', 'id-1', 'org-1')
      expect(unknown.valid).toBe(false)
      expect(unknown.violations[0]).toContain('Unknown entity type')

      mockOrderRepo.findById.mockResolvedValue(null)
      const missing = await checkEntityExists('order', 'id-1', 'org-1')
      expect(missing.valid).toBe(false)
      expect(missing.violations[0]).toContain('not found')
    })

    it('validates quote invariants', async () => {
      mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', customerId: 'c-1', total: 50 })
      mockCustomerRepo.findById.mockResolvedValue({ id: 'c-1' })

      const ok = await checkQuoteInvariants('q-1', 'org-1')
      expect(ok.valid).toBe(true)

      mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', customerId: null, total: -1 })
      const bad = await checkQuoteInvariants('q-1', 'org-1')
      expect(bad.valid).toBe(false)
      expect(bad.violations).toContain('Quote has no customer assigned')
      expect(bad.violations).toContain('Quote total is invalid')
    })

    it('validates order invariants', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', customerId: 'c-1', total: 10 })
      const ok = await checkOrderInvariants('o-1', 'org-1')
      expect(ok.valid).toBe(true)

      mockOrderRepo.findById.mockResolvedValue({ id: 'o-1', customerId: null, total: -10 })
      const bad = await checkOrderInvariants('o-1', 'org-1')
      expect(bad.valid).toBe(false)
      expect(bad.violations).toContain('Order has no customer assigned')
      expect(bad.violations).toContain('Order total is invalid')
    })

    it('validates purchase-order invariants', async () => {
      mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', orderId: 'o-1', supplierId: 'v-1' })
      mockOrderRepo.findById.mockResolvedValue({ id: 'o-1' })
      mockVendorRepo.findById.mockResolvedValue({ id: 'v-1' })
      const ok = await checkPurchaseOrderInvariants('po-1', 'org-1')
      expect(ok.valid).toBe(true)

      mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', orderId: null, supplierId: null })
      const bad = await checkPurchaseOrderInvariants('po-1', 'org-1')
      expect(bad.valid).toBe(false)
      expect(bad.violations).toContain('PurchaseOrder has no orderId')
      expect(bad.violations).toContain('PurchaseOrder has no supplier assigned')
    })

    it('validates production-job invariants', async () => {
      mockProductionRepo.findById.mockResolvedValue({ id: 'j-1', orderId: 'o-1', assignedVendorId: 'v-1' })
      const ok = await checkProductionJobInvariants('j-1', 'org-1')
      expect(ok.valid).toBe(true)

      mockProductionRepo.findById.mockResolvedValue({ id: 'j-1', orderId: null, assignedVendorId: null })
      const bad = await checkProductionJobInvariants('j-1', 'org-1')
      expect(bad.valid).toBe(false)
      expect(bad.violations).toContain('ProductionJob has no orderId')
      expect(bad.violations).toContain('ProductionJob has no vendor assigned')
    })
  })
})
