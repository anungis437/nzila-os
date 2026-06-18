import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetRegisteredCommandTypes,
  mockGetRequiredCriticalCommandTypes,
  mockGetRegisteredSideEffectTypes,
  mockIsEventPersistenceInitialized,
  mockRegisterSideEffectHandler,
  mockLogger,
  mockZohoAdapter,
  mockShopifyAdapter,
  mockCanvaAdapter,
} = vi.hoisted(() => ({
  mockGetRegisteredCommandTypes: vi.fn(),
  mockGetRequiredCriticalCommandTypes: vi.fn(),
  mockGetRegisteredSideEffectTypes: vi.fn(),
  mockIsEventPersistenceInitialized: vi.fn(),
  mockRegisterSideEffectHandler: vi.fn(),
  mockLogger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
  mockZohoAdapter: {
    pushPurchaseOrder: vi.fn(),
    pushInvoice: vi.fn(),
    syncVendors: vi.fn(),
  },
  mockShopifyAdapter: {
    pushOrder: vi.fn(),
    getFulfillmentStatus: vi.fn(),
    syncProducts: vi.fn().mockResolvedValue({ created: 1, updated: 2, skipped: 0 }),
  },
  mockCanvaAdapter: {
    exportDesign: vi.fn(),
  },
}))

vi.mock('@/lib/control/command-bus', () => ({
  getRegisteredCommandTypes: mockGetRegisteredCommandTypes,
  getRequiredCriticalCommandTypes: mockGetRequiredCriticalCommandTypes,
}))

vi.mock('@/lib/control/dispatch/side-effect-dispatcher', () => ({
  REQUIRED_SIDE_EFFECT_TYPES: ['zoho_sync', 'shopify_sync', 'canva_update', 'customer_notification'],
  getRegisteredSideEffectTypes: mockGetRegisteredSideEffectTypes,
  registerSideEffectHandler: mockRegisterSideEffectHandler,
}))

vi.mock('@/lib/events/persist', () => ({
  isEventPersistenceInitialized: mockIsEventPersistenceInitialized,
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('@/lib/integrations/zoho.adapter', () => ({
  createZohoAdapter: vi.fn(() => mockZohoAdapter),
}))

vi.mock('@/lib/integrations/shopify.adapter', () => ({
  createShopifyAdapter: vi.fn(() => mockShopifyAdapter),
}))

vi.mock('@/lib/integrations/canva.adapter', () => ({
  createCanvaAdapter: vi.fn(() => mockCanvaAdapter),
}))

describe('Flow control assertions + integrations slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('validateBootstrapState returns failures for missing registrations', async () => {
    mockGetRegisteredCommandTypes.mockReturnValue(['send_quote'])
    mockGetRequiredCriticalCommandTypes.mockReturnValue(['send_quote', 'accept_quote'])
    mockGetRegisteredSideEffectTypes.mockReturnValue(['zoho_sync'])
    mockIsEventPersistenceInitialized.mockReturnValue(false)

    const { validateBootstrapState, assertBootstrapState } = await import('@/lib/control/bootstrap-assertions')

    const result = validateBootstrapState()
    expect(result.ok).toBe(false)
    expect(result.missingCriticalCommands).toEqual(['accept_quote'])
    expect(result.eventPersistenceInitialized).toBe(false)
    expect(() => assertBootstrapState({ strict: true })).toThrow('Flow control bootstrap failed:')
  })

  it('covers validate/assert success and non-strict behavior', async () => {
    const { validateBootstrapState, assertBootstrapState } = await import('@/lib/control/bootstrap-assertions')

    mockGetRegisteredCommandTypes.mockReturnValue(['send_quote', 'accept_quote'])
    mockGetRequiredCriticalCommandTypes.mockReturnValue(['send_quote', 'accept_quote'])
    mockGetRegisteredSideEffectTypes.mockReturnValue([
      'zoho_sync',
      'shopify_sync',
      'canva_update',
      'customer_notification',
    ])
    mockIsEventPersistenceInitialized.mockReturnValue(true)

    const ok = validateBootstrapState()
    expect(ok.ok).toBe(true)
    expect(ok.errors).toEqual([])

    const assertedOk = assertBootstrapState({ strict: true })
    expect(assertedOk.ok).toBe(true)

    mockGetRegisteredCommandTypes.mockReturnValue([])
    mockGetRequiredCriticalCommandTypes.mockReturnValue(['send_quote'])
    mockGetRegisteredSideEffectTypes.mockReturnValue([])
    mockIsEventPersistenceInitialized.mockReturnValue(false)

    const nonStrict = assertBootstrapState({ strict: false })
    expect(nonStrict.ok).toBe(false)
    expect(nonStrict.errors.length).toBeGreaterThan(0)

    // In test env, strict defaults to false and should not throw.
    expect(() => assertBootstrapState()).not.toThrow()
  })

  it('register-integrations wires handlers and executes key side-effect branches', async () => {
    process.env.ZOHO_CLIENT_ID = 'id'
    process.env.SHOPIFY_SHOP_DOMAIN = 'example.myshopify.com'
    process.env.CANVA_API_KEY = 'token'
    process.env.NOTIFICATION_PROVIDER = ''

    await import('@/lib/control/register-integrations')

    expect(mockRegisterSideEffectHandler).toHaveBeenCalledTimes(4)

    const calls = mockRegisterSideEffectHandler.mock.calls
    const zohoHandler = calls.find((c) => c[0] === 'zoho_sync')?.[1]
    const shopifyHandler = calls.find((c) => c[0] === 'shopify_sync')?.[1]
    const canvaHandler = calls.find((c) => c[0] === 'canva_update')?.[1]
    const notifyHandler = calls.find((c) => c[0] === 'customer_notification')?.[1]

    const base = { org_id: 'org-1', metadata: { actor_id: 'actor-1', correlation_id: 'corr-1' } }

    await zohoHandler({ ...base, metadata: { ...base.metadata, action: 'sync_vendors' } })
    expect(mockZohoAdapter.syncVendors).toHaveBeenCalledTimes(1)

    await zohoHandler({ ...base, metadata: { ...base.metadata, action: 'push_po', po_data: { id: 'po-1' } } })
    await zohoHandler({ ...base, metadata: { ...base.metadata, action: 'push_invoice', invoice_data: { id: 'inv-1' } } })
    expect(mockZohoAdapter.pushPurchaseOrder).toHaveBeenCalledTimes(1)
    expect(mockZohoAdapter.pushInvoice).toHaveBeenCalledTimes(1)

    await shopifyHandler({ ...base, metadata: { ...base.metadata, action: 'sync_products' } })
    expect(mockShopifyAdapter.syncProducts).toHaveBeenCalledTimes(1)

    await shopifyHandler({ ...base, metadata: { ...base.metadata, action: 'push_order', order_data: { id: 'ord-1' } } })
    await shopifyHandler({ ...base, metadata: { ...base.metadata, action: 'get_fulfillment_status', shopify_order_id: 123 } })
    expect(mockShopifyAdapter.pushOrder).toHaveBeenCalledTimes(1)
    expect(mockShopifyAdapter.getFulfillmentStatus).toHaveBeenCalledWith(123)

    const missingSyncMeta = await shopifyHandler({ org_id: 'org-1', metadata: { action: 'sync_products' } })
    expect(missingSyncMeta.success).toBe(false)

    await canvaHandler({ ...base, metadata: { ...base.metadata, action: 'export_design', design_id: 'd-1' } })
    expect(mockCanvaAdapter.exportDesign).toHaveBeenCalledWith('d-1')

    const notifyRes = await notifyHandler({ ...base, metadata: { notification_type: 'quote_sent' } })
    expect(notifyRes.success).toBe(false)
  })

  it('register-integrations covers no-credentials skips and configured provider fallback', async () => {
    process.env.ZOHO_CLIENT_ID = ''
    process.env.SHOPIFY_SHOP_DOMAIN = ''
    process.env.CANVA_API_KEY = ''
    process.env.NOTIFICATION_PROVIDER = 'smtp'

    await import('@/lib/control/register-integrations')

    const calls = mockRegisterSideEffectHandler.mock.calls
    const zohoHandler = calls.find((c) => c[0] === 'zoho_sync')?.[1]
    const shopifyHandler = calls.find((c) => c[0] === 'shopify_sync')?.[1]
    const canvaHandler = calls.find((c) => c[0] === 'canva_update')?.[1]
    const notifyHandler = calls.find((c) => c[0] === 'customer_notification')?.[1]

    const base = { org_id: 'org-1', metadata: { actor_id: 'actor-1', correlation_id: 'corr-1' } }

    await expect(zohoHandler(base)).resolves.toMatchObject({ success: true, warning: 'No credentials configured' })
    await expect(shopifyHandler(base)).resolves.toMatchObject({ success: true, warning: 'No credentials configured' })
    await expect(canvaHandler(base)).resolves.toMatchObject({ success: true, warning: 'No credentials configured' })
    expect(mockZohoAdapter.syncVendors).not.toHaveBeenCalled()
    expect(mockShopifyAdapter.syncProducts).not.toHaveBeenCalled()
    expect(mockCanvaAdapter.exportDesign).not.toHaveBeenCalled()

    const notifyRes = await notifyHandler({ ...base, metadata: { notification_type: 'quote_sent' } })
    expect(notifyRes.success).toBe(false)
    expect(notifyRes.error).toContain('smtp')
  })

  it('event requirement marks critical success without events as violation', async () => {
    const { enforceCriticalCommandEventRequirement } = await import('@/lib/control/dispatch/event-requirement')

    expect(
      enforceCriticalCommandEventRequirement({
        commandType: 'send_quote',
        isCritical: true,
        success: true,
        emittedEventIds: [],
      }).ok,
    ).toBe(false)

    expect(
      enforceCriticalCommandEventRequirement({
        commandType: 'send_quote',
        isCritical: true,
        success: true,
        emittedEventIds: ['evt-1'],
      }).ok,
    ).toBe(true)
  })
})
