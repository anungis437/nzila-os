import { describe, expect, it } from 'vitest'

describe('barrel and telemetry slices', () => {
  it('covers commerce telemetry re-exports', async () => {
    const telemetry = await import('@/lib/commerce-telemetry')

    expect(typeof telemetry.logTransition).toBe('function')
    expect(typeof telemetry.logSagaExecution).toBe('function')
    expect(typeof telemetry.logGovernanceGate).toBe('function')
    expect(typeof telemetry.logEvidencePack).toBe('function')
    expect(typeof telemetry.logAuditTrail).toBe('function')
    expect(typeof telemetry.buildTransitionSpanAttrs).toBe('function')
    expect(typeof telemetry.buildSagaSpanAttrs).toBe('function')
    expect(telemetry.COMMERCE_SPAN).toBeTruthy()
    expect(telemetry.COMMERCE_METRIC).toBeTruthy()
    expect(telemetry.commerceMetrics).toBeTruthy()
    expect(telemetry.COMMERCE_HEALTH_CHECKS).toBeTruthy()
    expect(typeof telemetry.buildHealthResult).toBe('function')
    expect(typeof telemetry.aggregateHealth).toBe('function')
  })

  it('covers barrel exports for control, workflows, integrations, shopify, zoho, and domain', async () => {
    const control = await import('@/lib/control')
    const workflows = await import('@/lib/workflows')
    const integrations = await import('@/lib/integrations')
    const shopify = await import('@/lib/shopify')
    const zoho = await import('@/lib/zoho')
    const domain = await import('@/domain')

    expect(typeof control.execute).toBe('function')
    expect(typeof control.getRegisteredCommandTypes).toBe('function')
    expect(typeof control.dispatchDomainEvent).toBe('function')
    expect(typeof control.InvalidTransitionError).toBe('function')

    expect(typeof workflows.attemptOrderTransition).toBe('function')
    expect(typeof workflows.attemptPOTransition).toBe('function')
    expect(typeof workflows.attemptProductionTransition).toBe('function')
    expect(typeof workflows.attemptShipmentTransition).toBe('function')
    expect(typeof workflows.attemptQuoteTransition).toBe('function')

    expect(typeof integrations.createShopifyAdapter).toBe('function')
    expect(typeof integrations.createZohoAdapter).toBe('function')
    expect(typeof integrations.createCanvaAdapter).toBe('function')

    expect(typeof shopify.ShopifyClient).toBe('function')
    expect(typeof shopify.ShopifySyncService).toBe('function')

    expect(typeof zoho.ZohoOAuthClient).toBe('function')
    expect(typeof zoho.ZohoCrmClient).toBe('function')
    expect(typeof zoho.ZohoBooksClient).toBe('function')
    expect(typeof zoho.ZohoInventoryClient).toBe('function')
    expect(typeof zoho.ZohoSyncService).toBe('function')

    expect(domain.QuoteStatus).toBeTruthy()
    expect(domain.OrderStatus).toBeTruthy()
    expect(typeof domain.quoteCanBeSent).toBe('function')
    expect(typeof domain.orderCanBeConfirmed).toBe('function')
    expect(typeof domain.canConvertQuoteToOrder).toBe('function')
  }, 45000)
})
