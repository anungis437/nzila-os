import { describe, expect, it } from 'vitest'
import {
  quoteCanBeSent,
  orderCanBeConfirmed,
  depositSatisfied,
  fullPaymentSatisfied,
  poCanBeSent,
  productionCanStart,
  shipmentHasTrackingInfo,
  invoiceCanBeIssued,
  invoiceCanBeVoided,
} from '@/domain/invariants'
import {
  canConvertQuoteToOrder,
  canCreatePOFromOrder,
  canStartProductionFromPO,
  canCreateInvoiceFromOrder,
} from '@/domain/conversion-rules'

describe('Flow domain rules slice', () => {
  it('quote/order/po invariants pass and fail expected scenarios', () => {
    expect(
      quoteCanBeSent({ customer_id: 'c-1', valid_until: new Date(Date.now() + 60_000), total_amount: 10 }, 1).valid,
    ).toBe(true)
    expect(
      quoteCanBeSent({ customer_id: null as never, valid_until: null, total_amount: 0 }, 0).valid,
    ).toBe(false)

    expect(orderCanBeConfirmed({ status: 'CREATED', customer_id: 'c-1', total_amount: 100 }).valid).toBe(true)
    expect(orderCanBeConfirmed({ status: 'CANCELLED', customer_id: null as never, total_amount: 0 }).valid).toBe(false)

    expect(poCanBeSent({ vendor_id: 'v-1', status: 'DRAFT', total_amount: 100 }, 1).valid).toBe(true)
    expect(poCanBeSent({ vendor_id: null as never, status: 'CANCELLED', total_amount: 0 }, 0).valid).toBe(false)
  })

  it('payment and production invariants evaluate deposit/full-payment gates', () => {
    expect(
      depositSatisfied({ depositRequired: true, depositPercent: 50, totalAmount: 200, totalPaid: 120 }).valid,
    ).toBe(true)
    expect(
      depositSatisfied({ depositRequired: true, depositPercent: 50, totalAmount: 200, totalPaid: 10 }).valid,
    ).toBe(false)

    expect(
      fullPaymentSatisfied({ depositRequired: false, depositPercent: 0, totalAmount: 200, totalPaid: 200 }).valid,
    ).toBe(true)
    expect(
      fullPaymentSatisfied({ depositRequired: false, depositPercent: 0, totalAmount: 200, totalPaid: 199 }).valid,
    ).toBe(false)

    expect(
      productionCanStart(
        { vendor_id: 'v-1' },
        { depositRequired: true, depositPercent: 50, totalAmount: 1000, totalPaid: 600 },
      ).valid,
    ).toBe(true)
    expect(
      productionCanStart(
        { vendor_id: null as never },
        { depositRequired: true, depositPercent: 50, totalAmount: 1000, totalPaid: 100 },
      ).valid,
    ).toBe(false)
  })

  it('shipment and invoice invariants enforce status/field constraints', () => {
    expect(shipmentHasTrackingInfo({ carrier: 'DHL', tracking_number: 'TRK123' }).valid).toBe(true)
    expect(shipmentHasTrackingInfo({ carrier: '', tracking_number: '' }).valid).toBe(false)

    expect(invoiceCanBeIssued({ status: 'DRAFT', amount: 20 }).valid).toBe(true)
    expect(invoiceCanBeIssued({ status: 'PAID', amount: 0 }).valid).toBe(false)

    expect(invoiceCanBeVoided({ status: 'SENT' }).valid).toBe(true)
    expect(invoiceCanBeVoided({ status: 'PAID' }).valid).toBe(false)
  })

  it('conversion rules enforce lifecycle gates', () => {
    expect(
      canConvertQuoteToOrder({ status: 'ACCEPTED', customer_id: 'c-1', total_amount: 100 }, 1).valid,
    ).toBe(true)
    expect(
      canConvertQuoteToOrder({ status: 'DRAFT', customer_id: null as never, total_amount: 0 }, 0).valid,
    ).toBe(false)

    expect(canCreatePOFromOrder({ status: 'CONFIRMED', payment_status: 'PAID' }, true).valid).toBe(true)
    expect(canCreatePOFromOrder({ status: 'CREATED', payment_status: 'NOT_REQUIRED' }, false).valid).toBe(false)

    expect(
      canStartProductionFromPO(
        { status: 'CONFIRMED', vendor_id: 'v-1' },
        { payment_status: 'PARTIALLY_PAID' },
      ).valid,
    ).toBe(true)
    expect(
      canStartProductionFromPO(
        { status: 'DRAFT', vendor_id: null as never },
        { payment_status: 'PENDING_DEPOSIT' as never },
      ).valid,
    ).toBe(false)

    expect(
      canCreateInvoiceFromOrder({ status: 'DELIVERED', customer_id: 'c-1', total_amount: 100 }).valid,
    ).toBe(true)
    expect(
      canCreateInvoiceFromOrder({ status: 'CANCELLED', customer_id: null as never, total_amount: 0 }).valid,
    ).toBe(false)
  })
})
