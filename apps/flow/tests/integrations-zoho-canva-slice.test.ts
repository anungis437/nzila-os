import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockWithSpan,
  mockGetVendors,
  mockCreatePurchaseOrder,
  mockCreateInvoice,
  mockCreateContact,
  mockSelectLimit,
  mockSelectWhere,
} = vi.hoisted(() => ({
  mockWithSpan: vi.fn(async (_n: string, _a: unknown, fn: () => Promise<unknown>) => fn()),
  mockGetVendors: vi.fn(),
  mockCreatePurchaseOrder: vi.fn(),
  mockCreateInvoice: vi.fn(),
  mockCreateContact: vi.fn(),
  mockSelectLimit: vi.fn(),
  mockSelectWhere: vi.fn(),
}))

vi.mock('@nzila/os-core/telemetry', () => ({ withSpan: mockWithSpan }))

vi.mock('@/lib/zoho', () => ({
  ZohoOAuthClient: class {},
  ZohoBooksClient: class {
    getVendors = mockGetVendors
    createPurchaseOrder = mockCreatePurchaseOrder
    createInvoice = mockCreateInvoice
  },
  ZohoCrmClient: class {
    createContact = mockCreateContact
  },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    limit: mockSelectLimit,
  }
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
  }
  const insertChain = {
    values: vi.fn(() => insertChain),
  }
  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
    },
  }
})

vi.mock('@nzila/db/schema', () => ({
  commerceSuppliers: { id: 'id', orgId: 'orgId', zohoVendorId: 'zohoVendorId' },
}))

describe('zoho and canva adapter slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
  })

  it('zoho adapter covers vendor fetch, pushes, sync and CRM sync', async () => {
    const { createZohoAdapter } = await import('@/lib/integrations/zoho.adapter')
    const adapter = createZohoAdapter({
      clientId: 'cid',
      clientSecret: 'sec',
      redirectUri: 'http://localhost',
      orgId: 'org-1',
    })

    mockGetVendors.mockResolvedValueOnce({ data: [{ vendor_id: 'v1' }] })
    expect((await adapter.getVendors()).length).toBe(1)

    mockCreatePurchaseOrder.mockResolvedValueOnce({ purchaseorder_id: 'po-1' })
    const po = await adapter.pushPurchaseOrder({ id: 'po-local', vendor_id: 'v1' } as never)
    expect(po.zohoPOId).toBe('po-1')

    mockCreateInvoice.mockResolvedValueOnce({ invoice_id: 'inv-1' })
    const invoice = await adapter.pushInvoice({ id: 'inv-local', customer_id: 'c1', amount: 10 } as never)
    expect(invoice.zohoInvoiceId).toBe('inv-1')

    mockGetVendors.mockResolvedValueOnce({
      data: [
        { vendor_id: 'v1', company_name: 'Existing', contact_name: 'E', payment_terms_label: 'Net 30' },
        { vendor_id: 'v2', company_name: 'New', contact_name: 'N', payment_terms_label: 'Net 15' },
      ],
    })
    mockSelectLimit.mockResolvedValueOnce([{ id: 's-1' }]).mockResolvedValueOnce([])
    const sync = await adapter.syncVendors()
    expect(sync.synced).toBe(2)
    expect(sync.errors).toBe(0)

    mockCreateContact.mockResolvedValueOnce({ id: 'crm-1' })
    const crm = await adapter.syncCustomerToCRM({ name: 'Jane Doe', email: 'jane@example.com' })
    expect(crm).toEqual({ id: 'crm-1' })
  })

  it('zoho adapter covers empty vendor payload, per-vendor errors, and single-name CRM mapping', async () => {
    const { createZohoAdapter } = await import('@/lib/integrations/zoho.adapter')
    const { db } = await import('@nzila/db')

    const adapter = createZohoAdapter({
      clientId: 'cid',
      clientSecret: 'sec',
      redirectUri: 'http://localhost',
      orgId: 'org-1',
      scope: ['ZohoBooks.fullaccess.all'],
    })

    mockGetVendors.mockResolvedValueOnce({})
    await expect(adapter.getVendors()).resolves.toEqual([])

    mockGetVendors.mockResolvedValueOnce({
      data: [
        {
          vendor_id: 'v3',
          company_name: '',
          contact_name: '',
          email: null,
          phone: null,
          payment_terms_label: null,
        },
        {
          vendor_id: 'v4',
          company_name: null,
          contact_name: 'Only Contact',
          email: 'v4@example.com',
          phone: '123',
          payment_terms_label: 'Net 45',
        },
      ],
    })
    mockSelectLimit.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('lookup failed'))

    const sync = await adapter.syncVendors()
    expect(sync.synced).toBe(1)
    expect(sync.errors).toBe(1)

    const insertCall = (db.insert as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(insertCall).toBeTruthy()

    mockCreateContact.mockResolvedValueOnce({ id: 'crm-2' })
    await adapter.syncCustomerToCRM({ name: 'Prince', email: 'prince@example.com' })
    expect(mockCreateContact).toHaveBeenLastCalledWith(
      expect.objectContaining({
        First_Name: 'Prince',
        Last_Name: 'Prince',
      }),
    )
  })

  it('canva adapter fail-fast methods and healthCheck', async () => {
    const { createCanvaAdapter } = await import('@/lib/integrations/canva.adapter')

    const adapterNoToken = createCanvaAdapter({ apiToken: '' })
    expect(await adapterNoToken.healthCheck()).toEqual({ configured: false, reachable: false })

    const adapter = createCanvaAdapter({ apiToken: 'tok' })
    expect(await adapter.healthCheck()).toEqual({ configured: true, reachable: false })

    await expect(adapter.createDesignFromTemplate({ templateId: 't1', title: 'Proof' })).rejects.toThrow('Canva Connect API not implemented')
    await expect(adapter.getDesign('d1')).rejects.toThrow('Canva Connect API not implemented')
    await expect(adapter.exportDesign('d1', 'pdf')).rejects.toThrow('Canva Connect API not implemented')
  })
})
