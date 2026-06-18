import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockQuoteRepo,
  mockCustomerRepo,
  mockResolveOrgCommerceContext,
  mockCalculateTaxes,
  mockLogTransition,
  mockExecuteCommand,
  mockLogger,
} = vi.hoisted(() => ({
  mockQuoteRepo: {
    create: vi.fn(),
    findById: vi.fn(),
  },
  mockCustomerRepo: {
    findByEmail: vi.fn(),
    create: vi.fn(),
  },
  mockResolveOrgCommerceContext: vi.fn(),
  mockCalculateTaxes: vi.fn(),
  mockLogTransition: vi.fn(),
  mockExecuteCommand: vi.fn(),
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: mockQuoteRepo,
  customerRepo: mockCustomerRepo,
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgCommerceContext: mockResolveOrgCommerceContext,
}))

vi.mock('@nzila/platform-commerce-org/pricing', () => ({
  calculateTaxes: mockCalculateTaxes,
}))

vi.mock('@/lib/commerce-telemetry', () => ({
  logTransition: mockLogTransition,
}))

vi.mock('@/lib/control/control-adapter', () => ({
  executeCommand: mockExecuteCommand,
}))

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}))

describe('actions slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgCommerceContext.mockResolvedValue({
      ctx: { orgId: 'org-1', actorId: 'user-1' },
      config: { settings: { taxes: [] } },
    })
    mockCalculateTaxes.mockReturnValue({
      taxes: [{ amount: '5.00' }, { amount: '9.98' }],
      totalWithTax: '114.98',
    })
  })

  it('covers createQuoteAction with customer create and customer reuse branches', async () => {
    const actions = await import('@/lib/actions')

    mockCustomerRepo.findByEmail.mockResolvedValueOnce(null)
    mockCustomerRepo.create.mockResolvedValueOnce({ id: 'cust-1' })
    mockQuoteRepo.create.mockResolvedValueOnce({ id: 'q-1', reference: 'Q-1' })

    const created = await actions.createQuoteAction({
      clientName: 'Jane Doe',
      clientEmail: 'jane@example.com',
      clientPhone: '555-0101',
      title: 'Corporate Gifts',
      tier: 'PREMIUM',
      boxCount: 10,
      theme: 'Wellness',
      notes: 'VIP',
      lines: [{ description: 'Tea Set', sku: 'TEA-1', quantity: 2, unitCost: 50 }],
    })

    expect(created).toMatchObject({ ok: true, data: { id: 'q-1', reference: 'Q-1' } })
    expect(mockCustomerRepo.create).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', name: 'Jane Doe' }))
    expect(mockQuoteRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        customerId: 'cust-1',
        subtotal: 100,
        gst: 5,
        qst: 9.98,
        total: 114.98,
        lines: [expect.objectContaining({ description: 'Tea Set', quantity: 2, lineTotal: 100 })],
      }),
    )

    mockCustomerRepo.findByEmail.mockResolvedValueOnce({ id: 'cust-existing' })
    mockQuoteRepo.create.mockResolvedValueOnce({ id: 'q-2', reference: 'Q-2' })

    const reused = await actions.createQuoteAction({
      clientName: 'Existing',
      clientEmail: 'existing@example.com',
      clientPhone: '',
      title: 'Repeat',
      tier: 'STANDARD',
      boxCount: 3,
      theme: '',
      notes: '',
      lines: [{ description: 'Mug', sku: 'MUG-1', quantity: 1, unitCost: 25 }],
    })

    expect(reused).toMatchObject({ ok: true, data: { id: 'q-2', reference: 'Q-2' } })
    expect(mockQuoteRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-existing', theme: undefined, notes: undefined }),
    )
  })

  it('covers createQuoteAction failure branch', async () => {
    const actions = await import('@/lib/actions')

    mockResolveOrgCommerceContext.mockRejectedValueOnce(new Error('context down'))
    await expect(
      actions.createQuoteAction({
        clientName: 'A',
        clientEmail: '',
        clientPhone: '',
        title: 'T',
        tier: 'BUDGET',
        boxCount: 1,
        theme: '',
        notes: '',
        lines: [],
      }),
    ).resolves.toMatchObject({ ok: false, error: 'context down' })
  })

  it('covers import and validate legacy records branches', async () => {
    const actions = await import('@/lib/actions')

    mockQuoteRepo.create
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ id: 'b' })
      .mockRejectedValueOnce(new Error('insert failed'))

    const imported = await actions.importLegacyRecordsAction([
      { id: 'l1', client_id: 'c1', title: 'Budget deal', box_count: 2, budget_range: 'basic' },
      { id: 'l2', client_id: 'c2', title: 'Premium deal', box_count: 4, budget_range: 'luxury' },
      { id: 'l3', client_id: 'c3', title: 'Fail deal', box_count: 6, budget_range: 'standard' },
    ])

    expect(imported.ok).toBe(true)
    expect(imported.data).toMatchObject({ totalRecords: 3, successCount: 2, failureCount: 1 })
    expect(imported.data?.failures[0]).toMatchObject({ legacyId: 'l3', error: 'insert failed' })

    const validated = await actions.validateLegacyDataAction([
      { id: '', client_id: '', title: '', box_count: 'bad' as unknown as number },
    ])
    expect(validated.ok).toBe(true)
    expect(validated.data?.valid).toBe(false)
    expect(validated.data?.errors.length).toBeGreaterThan(0)
  })

  it('covers updateQuoteStatusAction command mapping, command failure, and success branches', async () => {
    const actions = await import('@/lib/actions')

    await expect(actions.updateQuoteStatusAction('q-1', 'unknown_status')).resolves.toMatchObject({
      ok: false,
      error: 'No command handler for target status: unknown_status',
    })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'blocked by policy' })
    await expect(actions.updateQuoteStatusAction('q-2', 'SENT_TO_CLIENT')).resolves.toMatchObject({
      ok: false,
      error: 'blocked by policy',
    })

    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    mockQuoteRepo.findById.mockResolvedValueOnce({ status: 'draft' })
    await expect(actions.updateQuoteStatusAction('q-3', 'ACCEPTED')).resolves.toMatchObject({
      ok: true,
      data: { id: 'q-3', status: 'ACCEPTED' },
    })
    expect(mockLogTransition).toHaveBeenCalledWith(
      { orgId: 'org-1' },
      'quote',
      'draft',
      'ACCEPTED',
      true,
    )

    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    mockQuoteRepo.findById.mockResolvedValueOnce({ status: 'sent' })
    mockLogTransition.mockImplementationOnce(() => {
      throw new Error('telemetry unavailable')
    })

    await expect(actions.updateQuoteStatusAction('q-4', 'REVISION_REQUESTED')).resolves.toMatchObject({
      ok: true,
      data: { id: 'q-4', status: 'REVISION_REQUESTED' },
    })
    expect(mockLogger.warn).toHaveBeenCalled()
  })

  it('covers updateQuoteStatusAction outer catch branch', async () => {
    const actions = await import('@/lib/actions')

    mockExecuteCommand.mockRejectedValueOnce(new Error('command transport failed'))
    await expect(actions.updateQuoteStatusAction('q-9', 'SENT_TO_CLIENT')).resolves.toMatchObject({
      ok: false,
      error: 'command transport failed',
    })
  })
})
