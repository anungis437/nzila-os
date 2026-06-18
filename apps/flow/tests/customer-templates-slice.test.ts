import { describe, expect, it, vi } from 'vitest'

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_BRANDING: { companyName: 'ShopMoiCa' },
}))

describe('customer communication templates slice', () => {
  it('renders every template with required and optional fields', async () => {
    const { renderTemplate, getAvailableTemplates } = await import('@/lib/customer-communication/templates')

    const quote = renderTemplate('quote_sent', {
      customerName: 'Jane',
      quoteRef: 'Q-1',
      quoteTitle: 'Posters',
      totalFormatted: '$100',
      validUntil: '2026-06-30',
      portalUrl: 'https://example.com/q/1',
    })
    expect(quote.subject).toContain('Q-1')

    const rev = renderTemplate('revision_requested_ack', {
      customerName: 'Jane',
      quoteRef: 'Q-2',
      revisionMessage: 'Change colors',
    })
    expect(rev.body).toContain('Change colors')

    const deposit = renderTemplate('deposit_request', {
      customerName: 'Jane',
      quoteRef: 'Q-3',
      depositAmount: '$20',
      totalFormatted: '$100',
      depositPercent: 20,
    })
    expect(deposit.body).toContain('Deposit: $20 (20%)')

    const payment = renderTemplate('payment_received_confirmation', {
      customerName: 'Jane',
      quoteRef: 'Q-4',
      amountReceived: '$20',
      remainingBalance: '$80',
    })
    expect(payment.templateName).toBe('payment_received_confirmation')

    const prodNoEstimate = renderTemplate('order_in_production', {
      customerName: 'Jane',
      quoteRef: 'Q-5',
      orderRef: 'O-5',
    })
    expect(prodNoEstimate.body).not.toContain('Estimated completion')

    const prodWithEstimate = renderTemplate('order_in_production', {
      customerName: 'Jane',
      quoteRef: 'Q-5',
      orderRef: 'O-5',
      estimatedCompletion: '2026-07-01',
    })
    expect(prodWithEstimate.body).toContain('Estimated completion: 2026-07-01')

    const shippedNoTracking = renderTemplate('shipped_notice', {
      customerName: 'Jane',
      quoteRef: 'Q-6',
      orderRef: 'O-6',
    })
    expect(shippedNoTracking.body).not.toContain('Shipping details:')

    const shippedTracking = renderTemplate('shipped_notice', {
      customerName: 'Jane',
      quoteRef: 'Q-6',
      orderRef: 'O-6',
      carrier: 'DHL',
      trackingNumber: 'TRK123',
      estimatedDelivery: '2026-07-03',
    })
    expect(shippedTracking.body).toContain('Carrier: DHL')
    expect(shippedTracking.body).toContain('Tracking #: TRK123')
    expect(shippedTracking.body).toContain('Estimated delivery: 2026-07-03')

    const all = getAvailableTemplates()
    expect(all).toContain('quote_sent')
    expect(all).toContain('shipped_notice')
  })

  it('throws validation errors for invalid template data', async () => {
    const { renderTemplate } = await import('@/lib/customer-communication/templates')
    expect(() =>
      renderTemplate('quote_sent', {
        customerName: '',
        quoteRef: 'Q-1',
        quoteTitle: 'Posters',
        totalFormatted: '$100',
        validUntil: '2026-06-30',
        portalUrl: 'not-url',
      }),
    ).toThrow()
  })
})
