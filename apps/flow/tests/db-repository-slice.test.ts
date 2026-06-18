import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockSelect,
  mockInsert,
  mockUpdate,
  mockEq,
  mockDesc,
  mockSql,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn((a: unknown, b: unknown) => [a, b]),
  mockDesc: vi.fn((v: unknown) => v),
  mockSql: vi.fn((s: TemplateStringsArray) => s.join('')),
}))

vi.mock('drizzle-orm', () => ({
  eq: mockEq,
  desc: mockDesc,
  sql: mockSql,
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: {
    quotePrefix: 'QMCA',
    quoteValidityDays: 30,
    currency: 'CAD',
  },
}))

vi.mock('@nzila/db', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
  commerceQuotes: {
    id: 'id',
    orgId: 'orgId',
    status: 'status',
    createdAt: 'createdAt',
  },
  commerceQuoteLines: {
    quoteId: 'quoteId',
    sortOrder: 'sortOrder',
  },
  commerceCustomers: {
    id: 'id',
    email: 'email',
  },
}))

describe('db repository slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'uuid-fixed'),
    })
  })

  it('quoteRepo.create generates ref, inserts quote and optional lines', async () => {
    const countQuery = { from: vi.fn().mockResolvedValue([{ count: 2 }]) }
    const insertQuoteChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 'q-1',
          orgId: 'org-1',
          ref: 'QMCA-2026-003',
          status: 'draft',
          pricingTier: 'standard',
          customerId: 'c-1',
          metadata: { title: 'Quote A', boxCount: 2, theme: 'blue', gst: 1, qst: 2 },
          notes: null,
          subtotal: '100',
          total: '103',
          validUntil: new Date(Date.now() + 86_400_000),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          createdBy: 'u-1',
        },
      ]),
    }
    const insertLinesChain = { values: vi.fn().mockResolvedValue(undefined) }

    mockSelect.mockReturnValueOnce(countQuery)
    mockInsert.mockReturnValueOnce(insertQuoteChain).mockReturnValueOnce(insertLinesChain)

    const { quoteRepo } = await import('@/lib/db')
    const result = await quoteRepo.create({
      orgId: 'org-1',
      tier: 'STANDARD',
      customerId: 'c-1',
      lines: [
        {
          id: 'l-1',
          description: 'Line 1',
          sku: 'SKU-1',
          quantity: 1,
          unitCost: 100,
          lineTotal: 100,
          displayOrder: 0,
        },
      ],
      subtotal: 100,
      gst: 1,
      qst: 2,
      total: 103,
      createdBy: 'u-1',
      title: 'Quote A',
      boxCount: 2,
      theme: 'blue',
    })

    expect(result.id).toBe('q-1')
    expect(result.reference).toContain('QMCA-')
    expect(result.lines).toHaveLength(1)
    expect(mockInsert).toHaveBeenCalledTimes(2)
  })

  it('quoteRepo.create uses defaults and skips line insert when lines are empty', async () => {
    const countQuery = { from: vi.fn().mockResolvedValue([{}]) }
    const insertQuoteChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: 'q-default',
          orgId: 'org-1',
          ref: null,
          status: null,
          pricingTier: null,
          customerId: null,
          metadata: undefined,
          notes: null,
          subtotal: null,
          total: null,
          validUntil: null,
          createdAt: undefined,
          updatedAt: undefined,
          createdBy: null,
        },
      ]),
    }

    mockSelect.mockReturnValueOnce(countQuery)
    mockInsert.mockReturnValueOnce(insertQuoteChain)

    const { quoteRepo } = await import('@/lib/db')
    const result = await quoteRepo.create({
      orgId: 'org-1',
      tier: 'STANDARD',
      customerId: 'c-1',
    })

    expect(result.reference).toBe('')
    expect(result.status).toBe('draft')
    expect(result.tier).toBe('STANDARD')
    expect(result.customerId).toBe('')
    expect(result.boxCount).toBe(1)
    expect(result.theme).toBeNull()
    expect(result.gst).toBe(0)
    expect(result.qst).toBe(0)
    expect(result.subtotal).toBe(0)
    expect(result.total).toBe(0)
    expect(result.validUntilDays).toBe(30)
    expect(result.createdBy).toBe('system')
    expect(result.lines).toEqual([])
    expect(mockInsert).toHaveBeenCalledTimes(1)
    expect(insertQuoteChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'CAD',
        taxTotal: '0',
      }),
    )
  })

  it('quoteRepo.findById/findAll map rows and load lines', async () => {
    const quoteRow = {
      id: 'q-2',
      orgId: 'org-1',
      ref: 'QMCA-2026-004',
      status: 'accepted',
      pricingTier: 'premium',
      customerId: 'c-1',
      metadata: { title: 'Quote B', boxCount: 1, gst: 0, qst: 0 },
      notes: 'n',
      subtotal: '55',
      total: '55',
      validUntil: new Date(Date.now() + 2 * 86_400_000),
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdBy: 'u-2',
    }

    const lineRows = [
      {
        id: 'line-1',
        description: 'Desc',
        sku: 'SKU',
        quantity: 2,
        unitPrice: '10',
        lineTotal: '20',
        sortOrder: 1,
      },
    ]

    const findByIdSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([quoteRow]) })) })),
    }
    const loadLinesSelectForFindById = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue(lineRows) })) })),
    }

    const findAllSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([quoteRow]) })) })),
    }
    const loadLinesSelectForFindAll = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue(lineRows) })) })),
    }

    mockSelect
      .mockReturnValueOnce(findByIdSelect)
      .mockReturnValueOnce(loadLinesSelectForFindById)
      .mockReturnValueOnce(findAllSelect)
      .mockReturnValueOnce(loadLinesSelectForFindAll)

    const { quoteRepo } = await import('@/lib/db')

    const byId = await quoteRepo.findById('q-2')
    const all = await quoteRepo.findAll('org-1')

    expect(byId?.id).toBe('q-2')
    expect(byId?.lines).toHaveLength(1)
    expect(all).toHaveLength(1)
    expect(all[0].reference).toBe('QMCA-2026-004')
  })

  it('quoteRepo.findById returns null when quote does not exist', async () => {
    const findByIdSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    }
    mockSelect.mockReturnValueOnce(findByIdSelect)

    const { quoteRepo } = await import('@/lib/db')
    await expect(quoteRepo.findById('missing')).resolves.toBeNull()
  })

  it('quoteRepo.update returns updated quote or throws for missing row', async () => {
    const updatedRow = {
      id: 'q-3',
      orgId: 'org-1',
      ref: 'QMCA-2026-005',
      status: 'sent',
      pricingTier: 'standard',
      customerId: 'c-2',
      metadata: { title: 'Quote C', boxCount: 1, gst: 0, qst: 0 },
      notes: 'updated',
      subtotal: '20',
      total: '20',
      validUntil: new Date(Date.now() + 86_400_000),
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
      updatedAt: new Date('2026-01-04T00:00:00.000Z'),
      createdBy: 'u-3',
    }

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedRow]),
    }
    const updateMissingChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }
    const loadLinesSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })) })),
    }

    mockUpdate.mockReturnValueOnce(updateChain).mockReturnValueOnce(updateMissingChain)
    mockSelect.mockReturnValueOnce(loadLinesSelect)

    const { quoteRepo } = await import('@/lib/db')

    const updated = await quoteRepo.update('q-3', { status: 'SENT', subtotal: 20, total: 20 })
    expect(updated.status).toBe('sent')

    await expect(quoteRepo.update('q-missing', { status: 'DRAFT' })).rejects.toThrow('not found')
  })

  it('customerRepo supports lookup/list/create mappings', async () => {
    const row = {
      id: 'cust-1',
      orgId: 'org-1',
      name: 'Acme',
      email: 'a@b.com',
      phone: '123',
      address: { city: 'Montreal' },
      metadata: { zohoContactId: 'z-1' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }

    const findByEmailSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([row]) })) })),
    }
    const findByIdSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([row]) })) })),
    }
    const findAllSelect = {
      from: vi.fn().mockResolvedValue([row]),
    }
    const createChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([row]),
    }

    mockSelect
      .mockReturnValueOnce(findByEmailSelect)
      .mockReturnValueOnce(findByIdSelect)
      .mockReturnValueOnce(findAllSelect)
    mockInsert.mockReturnValueOnce(createChain)

    const { customerRepo } = await import('@/lib/db')

    expect((await customerRepo.findByEmail('a@b.com'))?.id).toBe('cust-1')
    expect((await customerRepo.findById('cust-1'))?.zohoContactId).toBe('z-1')
    expect((await customerRepo.findAll())).toHaveLength(1)

    const created = await customerRepo.create({
      orgId: 'org-1',
      name: 'Acme',
      email: 'a@b.com',
      phone: '123',
      address: { city: 'Montreal' },
      zohoContactId: 'z-1',
    })
    expect(created.id).toBe('cust-1')
  })

  it('customerRepo handles null lookups and create without zoho contact id', async () => {
    const findByEmailSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    }
    const findByIdSelect = {
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })),
    }
    const row = {
      id: 'cust-2',
      orgId: 'org-1',
      name: null,
      email: null,
      phone: null,
      address: null,
      metadata: undefined,
      createdAt: undefined,
    }
    const createChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([row]),
    }

    mockSelect
      .mockReturnValueOnce(findByEmailSelect)
      .mockReturnValueOnce(findByIdSelect)
    mockInsert.mockReturnValueOnce(createChain)

    const { customerRepo } = await import('@/lib/db')

    await expect(customerRepo.findByEmail('missing@x.com')).resolves.toBeNull()
    await expect(customerRepo.findById('missing')).resolves.toBeNull()

    const created = await customerRepo.create({
      orgId: 'org-1',
      name: 'No Zoho',
      email: null,
      phone: null,
      address: null,
      zohoContactId: null,
    })

    expect(createChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {},
      }),
    )
    expect(created.name).toBe('')
    expect(created.zohoContactId).toBeNull()
  })
})
