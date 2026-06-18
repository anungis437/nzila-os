import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockSelectWhere,
  mockSelectLimit,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockSelectWhere: vi.fn(),
  mockSelectLimit: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})) }))

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
  const deleteChain = {
    where: vi.fn(() => deleteChain),
  }

  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
      delete: vi.fn(() => deleteChain),
    },
    commerceZohoCredentials: { orgId: 'orgId' },
  }
})

function okJson(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response
}

function fail(status: number, body: string) {
  return {
    ok: false,
    status,
    statusText: body,
    json: async () => ({ message: body }),
    text: async () => body,
  } as Response
}

function getId(value: unknown): string | undefined {
  return (value as { id?: string } | null | undefined)?.id
}

describe('zoho oauth/crm client slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('zoho oauth client covers exchange/get token/revoke/factory paths', async () => {
    const { ZohoOAuthClient, createZohoOAuthClient } = await import('@/lib/zoho/oauth')

    const oauth = new ZohoOAuthClient('org-1', {
      clientId: 'cid',
      clientSecret: 'sec',
      redirectUri: 'http://localhost/callback',
      scope: ['a'],
    })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ access_token: 'at1', refresh_token: 'rt1', expires_in: 3600, api_domain: 'https://api.z' }),
    )
    const creds = await oauth.exchangeCodeForTokens('code-1')
    expect(creds.accessToken).toBe('at1')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    await expect(oauth.getAccessToken()).rejects.toThrow('No Zoho credentials')

    const future = new Date(Date.now() + 60 * 60 * 1000)
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        accessToken: 'at2',
        refreshToken: 'rt2',
        tokenExpiry: future,
        accountsServer: 'https://accounts.zoho.com',
        apiServer: 'https://www.zohoapis.com',
      },
    ])
    expect(await oauth.getAccessToken()).toBe('at2')

    const past = new Date(Date.now() - 60 * 1000)
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        accessToken: 'at-old',
        refreshToken: 'rt-old',
        tokenExpiry: past,
        accountsServer: 'https://accounts.zoho.com',
        apiServer: 'https://www.zohoapis.com',
      },
    ])
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ access_token: 'at3', refresh_token: 'rt3', expires_in: 3600, api_domain: 'https://api.z' }),
    )
    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        accessToken: 'at-old',
        refreshToken: 'rt-old',
        tokenExpiry: past,
        accountsServer: 'https://accounts.zoho.com',
        apiServer: 'https://www.zohoapis.com',
      },
    ])
    expect(await oauth.getAccessToken()).toBe('at3')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([
      {
        accessToken: 'at4',
        refreshToken: 'rt4',
        tokenExpiry: future,
        accountsServer: 'https://accounts.zoho.com',
        apiServer: 'https://www.zohoapis.com',
      },
    ])
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('net'))
    await oauth.revokeTokens()

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await oauth.hasCredentials()).toBe(false)

    delete process.env.ZOHO_CLIENT_ID
    delete process.env.ZOHO_CLIENT_SECRET
    expect(() => createZohoOAuthClient('org-1')).toThrow('Zoho OAuth credentials not configured')
  })

  it('zoho crm client covers contacts/deals/accounts, bulk limits, and API errors', async () => {
    const { ZohoCrmClient } = await import('@/lib/zoho/crm-client')
    const oauthClient = { getAccessToken: vi.fn().mockResolvedValue('token') }
    const client = new ZohoCrmClient(oauthClient as never)

    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(okJson({ data: [{ id: 'c1' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'c2' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'c3' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'c4' }] }))
      .mockResolvedValueOnce(okJson({ data: [] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'c5' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'd1' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'd2' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'd3' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'd4' }] }))
      .mockResolvedValueOnce(okJson({ data: [] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'a1' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'a2' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'a3' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'bc1' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'bu1' }] }))
      .mockResolvedValueOnce(okJson({ data: [{ id: 'bd1' }] }))

    expect((await client.getContacts(1, 2)).data?.length).toBe(1)
    expect((await client.getContactById('c2'))?.id).toBe('c2')
    expect((await client.createContact({ First_Name: 'A' } as never)).id).toBe('c3')
    expect((await client.updateContact('c4', { First_Name: 'B' } as never)).id).toBe('c4')
    await client.deleteContact('c4')
    expect((await client.searchContactsByEmail('x@example.com'))?.id).toBe('c5')

    expect((await client.getDeals()).data?.[0]?.id).toBe('d1')
    expect((await client.getDealById('d2'))?.id).toBe('d2')
    expect((await client.createDeal({ Deal_Name: 'D' } as never)).id).toBe('d3')
    expect((await client.updateDeal('d4', { Deal_Name: 'E' } as never)).id).toBe('d4')
    await client.deleteDeal('d4')

    expect((await client.getAccounts()).data?.[0]?.id).toBe('a1')
    expect((await client.getAccountById('a2'))?.id).toBe('a2')
    expect((await client.createAccount({ Account_Name: 'ACME' } as never)).id).toBe('a3')

    expect((await client.bulkCreateContacts([{ First_Name: 'X' }] as never)).data?.[0]?.id).toBe('bc1')
    expect((await client.bulkUpdateContacts([{ id: 'c1' }] as never)).data?.[0]?.id).toBe('bu1')
    expect((await client.bulkCreateDeals([{ Deal_Name: 'Z' }] as never)).data?.[0]?.id).toBe('bd1')

    await expect(client.bulkCreateContacts(new Array(101).fill({}) as never)).rejects.toThrow('limited to 100')
    await expect(client.bulkUpdateContacts(new Array(101).fill({ id: 'x' }) as never)).rejects.toThrow('limited to 100')
    await expect(client.bulkCreateDeals(new Array(101).fill({}) as never)).rejects.toThrow('limited to 100')

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(fail(500, 'boom'))
    await expect(client.getContacts()).rejects.toThrow('Zoho CRM API error')
  })

  it('zoho books and inventory clients cover wrapper operations and failure branches', async () => {
    const { ZohoBooksClient } = await import('@/lib/zoho/books-client')
    const { ZohoInventoryClient } = await import('@/lib/zoho/inventory-client')
    const oauthClient = { getAccessToken: vi.fn().mockResolvedValue('token') }

    const books = new ZohoBooksClient(oauthClient as never, { organizationId: 'org-books' })
    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(okJson({ code: 0, data: true, vendors: [{ id: 'v1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, vendor: { id: 'v2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, vendor: { id: 'v3' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, vendor: { id: 'v4' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, purchaseorders: [{ id: 'po1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, purchaseorder: { id: 'po2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, purchaseorder: { id: 'po3' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, purchaseorder: { id: 'po4' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, invoices: [{ id: 'i1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, invoice: { id: 'i2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true, invoice: { id: 'i3' } }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))
      .mockResolvedValueOnce(okJson({ code: 0, data: true }))

    await books.getVendors()
    expect(getId(await books.getVendorById('v2'))).toBe('v2')
    expect(getId(await books.createVendor({ contact_name: 'A' } as never))).toBe('v3')
    expect(getId(await books.updateVendor('v4', { contact_name: 'B' } as never))).toBe('v4')
    await books.deleteVendor('v4')

    await books.getPurchaseOrders()
    expect(getId(await books.getPurchaseOrderById('po2'))).toBe('po2')
    expect(getId(await books.createPurchaseOrder({} as never))).toBe('po3')
    expect(getId(await books.updatePurchaseOrder('po4', {} as never))).toBe('po4')
    await books.deletePurchaseOrder('po4')
    await books.submitPurchaseOrder('po4')
    await books.approvePurchaseOrder('po4')
    await books.markPurchaseOrderAsOpen('po4')

    await books.getInvoices()
    expect(getId(await books.getInvoiceById('i2'))).toBe('i2')
    expect(getId(await books.createInvoice({} as never))).toBe('i3')
    await books.markInvoiceAsSent('i3')
    await books.markInvoiceAsVoid('i3')

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockReset()

    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'it1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, item: { id: 'it2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'it3' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, item: { id: 'it4' } }))
      .mockResolvedValueOnce(okJson({ code: 0, item: { id: 'it5' } }))
      .mockResolvedValueOnce(okJson({ code: 0, item: { id: 'it6' } }))
      .mockResolvedValueOnce(okJson({ code: 0 }))
      .mockResolvedValueOnce(okJson({ code: 0 }))
      .mockResolvedValueOnce(okJson({ code: 0 }))
      .mockResolvedValueOnce(okJson({ code: 0, warehouses: [{ id: 'wh1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, warehouse: { id: 'wh2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, warehouse: { id: 'wh3' } }))
      .mockResolvedValueOnce(okJson({ code: 0, warehouse: { id: 'wh4' } }))
      .mockResolvedValueOnce(okJson({ code: 0 }))
      .mockResolvedValueOnce(
        okJson({
          code: 0,
          item: {
            warehouses: [
              { warehouse_id: 'wh1', warehouse_stock_on_hand: 8 },
              { warehouse_id: 'wh2', warehouse_stock_on_hand: 13 },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ code: 0, inventory_adjustment: { id: 'sa1' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'sa2' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'ci1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, composite_item: { id: 'ci2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'ig1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, transfer_order: { id: 'to1' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'to2' }] }))

    const inventory = new ZohoInventoryClient(oauthClient as never, { organizationId: 'org-inv' })
    await inventory.getItems()
    expect(getId(await inventory.getItemById('it2'))).toBe('it2')
    expect(getId(await inventory.getItemBySku('sku-1'))).toBe('it3')
    expect(getId(await inventory.createItem({} as never))).toBe('it4')
    expect(getId(await inventory.updateItem('it5', {} as never))).toBe('it5')
    await inventory.deleteItem('it6')
    await inventory.markItemAsActive('it6')
    await inventory.markItemAsInactive('it6')
    await inventory.getWarehouses()

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockReset()
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      okJson({ code: 0, warehouse: { id: 'wh2' } }),
    )
    expect(getId(await inventory.getWarehouseById('wh2'))).toBe('wh2')

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockReset()
    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(okJson({ code: 0, warehouse: { id: 'wh3' } }))
      .mockResolvedValueOnce(okJson({ code: 0, warehouse: { id: 'wh4' } }))
      .mockResolvedValueOnce(okJson({ code: 0 }))
      .mockResolvedValueOnce(
        okJson({
          code: 0,
          item: {
            warehouses: [
              { warehouse_id: 'wh1', warehouse_stock_on_hand: 8 },
              { warehouse_id: 'wh2', warehouse_stock_on_hand: 13 },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(okJson({ code: 0, inventory_adjustment: { id: 'sa1' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'sa2' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'ci1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, composite_item: { id: 'ci2' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'ig1' }] }))
      .mockResolvedValueOnce(okJson({ code: 0, transfer_order: { id: 'to1' } }))
      .mockResolvedValueOnce(okJson({ code: 0, items: [{ id: 'to2' }] }))

    expect(getId(await inventory.createWarehouse({} as never))).toBe('wh3')
    expect(getId(await inventory.updateWarehouse('wh4', {} as never))).toBe('wh4')
    await inventory.deleteWarehouse('wh4')
    expect(await inventory.getItemStock('it1')).toEqual({ wh1: 8, wh2: 13 })
    expect(getId(await inventory.createStockAdjustment({} as never))).toBe('sa1')
    await inventory.getStockAdjustments()
    await inventory.getCompositeItems()
    expect(getId(await inventory.createCompositeItem({ mapped_items: [] } as never))).toBe('ci2')
    await inventory.getItemGroups()
    expect(getId(await inventory.createTransferOrder({
      from_warehouse_id: 'wh1',
      to_warehouse_id: 'wh2',
      line_items: [{ item_id: 'it1', quantity: 1 }],
    }))).toBe('to1')
    await inventory.getTransferOrders()

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJson({ code: 1, message: 'bad' }))
    await expect(books.getVendors()).rejects.toThrow('Zoho Books API error')

    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(okJson({ code: 1, message: 'bad' }))
    await expect(inventory.getItems()).rejects.toThrow('Zoho Inventory API error')
  })

  it('zoho credential lookup returns first row or null', async () => {
    const { findZohoCredentialsByOrg } = await import('@/lib/zoho/credential-lookup')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([{ orgId: 'org-1', accessToken: 'at' }])
    expect(await findZohoCredentialsByOrg('org-1')).toEqual({ orgId: 'org-1', accessToken: 'at' })

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    expect(await findZohoCredentialsByOrg('org-2')).toBeNull()
  })
})
