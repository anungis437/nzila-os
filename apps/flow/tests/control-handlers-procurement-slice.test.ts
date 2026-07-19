import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  qLimit,
  qInsertReturning,
  mockCheckPurchaseOrderInvariants,
  mockCheckQuoteInvariants,
  mockValidateTransition,
  mockDispatchDomainEvent,
  mockDispatchAuditEntry,
  mockExecute,
  mockPurchaseOrderRepo,
  mockQuoteRepo,
} = vi.hoisted(() => ({
  qLimit: [] as unknown[][],
  qInsertReturning: [] as unknown[][],
  mockCheckPurchaseOrderInvariants: vi.fn(),
  mockCheckQuoteInvariants: vi.fn(),
  mockValidateTransition: vi.fn(),
  mockDispatchDomainEvent: vi.fn(),
  mockDispatchAuditEntry: vi.fn(),
  mockExecute: vi.fn(),
  mockPurchaseOrderRepo: {
    findById: vi.fn(),
    findLines: vi.fn(),
  },
  mockQuoteRepo: {
    findById: vi.fn(),
  },
}))

const shift = (queue: unknown[][]) => Promise.resolve((queue.shift() ?? []) as never)

vi.mock('@/lib/commands/types', () => ({
  ReceivePOLineCommand: { parse: (v: unknown) => v },
  TriggerSalesToProcurementCommand: { parse: (v: unknown) => v },
}))

vi.mock('@/lib/repositories', () => ({
  purchaseOrderRepo: mockPurchaseOrderRepo,
  quoteRepo: mockQuoteRepo,
}))

vi.mock('@/lib/control/guards/invariant-guard', () => ({
  checkPurchaseOrderInvariants: mockCheckPurchaseOrderInvariants,
  checkQuoteInvariants: mockCheckQuoteInvariants,
}))

vi.mock('@/lib/control/guards/workflow-guard', () => ({ validateTransition: mockValidateTransition }))
vi.mock('@/lib/control/dispatch/event-dispatcher', () => ({ dispatchDomainEvent: mockDispatchDomainEvent }))
vi.mock('@/lib/control/dispatch/audit-dispatcher', () => ({ dispatchAuditEntry: mockDispatchAuditEntry }))
vi.mock('@/lib/control/command-bus', () => ({ execute: mockExecute }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => shift(qLimit)),
  }

  const updateAfterSet = {
    where: vi.fn(() => Promise.resolve(undefined)),
  }

  const updateChain = {
    set: vi.fn(() => updateAfterSet),
  }

  const insertAfterValues = {
    returning: vi.fn(() => shift(qInsertReturning)),
  }

  const insertChain = {
    values: vi.fn(() => insertAfterValues),
  }

  return {
    db: {
      select: vi.fn(() => selectChain),
      update: vi.fn(() => updateChain),
      insert: vi.fn(() => insertChain),
    },
    commercePurchaseOrderLines: { id: 'id' },
    commercePurchaseOrders: { id: 'id', orgId: 'orgId' },
    commerceSuppliers: { id: 'id', orgId: 'orgId' },
  }
})

describe('control procurement handlers slices', () => {
  const context = { org_id: 'org-1', correlation_id: 'corr-1' } as const

  beforeEach(() => {
    vi.clearAllMocks()
    qLimit.length = 0
    qInsertReturning.length = 0

    mockCheckPurchaseOrderInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockCheckQuoteInvariants.mockResolvedValue({ valid: true, violations: [] })
    mockValidateTransition.mockReturnValue({ allowed: true })
    mockDispatchDomainEvent.mockReturnValue('evt-1')
    mockDispatchAuditEntry.mockResolvedValue('aud-1')
    mockPurchaseOrderRepo.findById.mockResolvedValue({ id: 'po-1', status: 'sent' })
    mockPurchaseOrderRepo.findLines.mockResolvedValue([
      { id: 'line-1', quantity: 10, quantityReceived: 0 },
      { id: 'line-2', quantity: 5, quantityReceived: 5 },
    ])
    mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', status: 'accepted' })
  })

  it('covers receive PO line blocked and transition branches', async () => {
    const { receivePOLineHandler } = await import('@/lib/control/handlers/receive-po-line.handler')

    mockCheckPurchaseOrderInvariants.mockResolvedValueOnce({ valid: false, violations: ['invalid po'] })
    expect(
      await receivePOLineHandler.execute(
        {
          purchase_order_id: 'po-1',
          line_id: 'line-1',
          quantity_received: 1,
          actor_id: 'user-1',
        } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    mockPurchaseOrderRepo.findById.mockResolvedValueOnce({ id: 'po-1', status: 'draft' })
    expect(
      await receivePOLineHandler.execute(
        {
          purchase_order_id: 'po-1',
          line_id: 'line-1',
          quantity_received: 1,
          actor_id: 'user-1',
        } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    qLimit.push([{ id: 'line-1', quantity: 10, quantityReceived: 0 }])
    mockPurchaseOrderRepo.findLines.mockResolvedValueOnce([
      { id: 'line-1', quantity: 10, quantityReceived: 0 },
      { id: 'line-2', quantity: 5, quantityReceived: 0 },
    ])
    expect(
      await receivePOLineHandler.execute(
        {
          purchase_order_id: 'po-1',
          line_id: 'line-1',
          quantity_received: 2,
          actor_id: 'user-1',
        } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'partial_received' })

    qLimit.push([{ id: 'line-1', quantity: 10, quantityReceived: 0 }])
    mockPurchaseOrderRepo.findLines.mockResolvedValueOnce([
      { id: 'line-1', quantity: 10, quantityReceived: 9 },
      { id: 'line-2', quantity: 5, quantityReceived: 5 },
    ])
    expect(
      await receivePOLineHandler.execute(
        {
          purchase_order_id: 'po-1',
          line_id: 'line-1',
          quantity_received: 10,
          actor_id: 'user-1',
        } as never,
        context as never,
      ),
    ).toMatchObject({ success: true, status_after: 'received' })
  })

  it('covers trigger sales->procurement invalid and command failure branches', async () => {
    const { triggerSalesToProcurementHandler } = await import('@/lib/control/handlers/trigger-sales-to-procurement.handler')

    mockCheckQuoteInvariants.mockResolvedValueOnce({ valid: false, violations: ['quote invalid'] })
    expect(
      await triggerSalesToProcurementHandler.execute(
        { quote_id: 'q-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'draft' })
    expect(
      await triggerSalesToProcurementHandler.execute(
        { quote_id: 'q-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockValidateTransition.mockReturnValueOnce({ allowed: false, reason: 'blocked' })
    expect(
      await triggerSalesToProcurementHandler.execute(
        { quote_id: 'q-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    qLimit.push([{ id: 'sup-1' }])
    mockExecute.mockResolvedValueOnce({ success: false, errors: [{ message: 'convert failed' }] })
    expect(
      await triggerSalesToProcurementHandler.execute(
        { quote_id: 'q-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })

    qLimit.push([{ id: 'sup-1' }])
    mockExecute.mockResolvedValueOnce({ success: true, entity_id: 'ord-1' })
    mockExecute.mockResolvedValueOnce({ success: false, errors: [{ message: 'po failed' }] })
    expect(
      await triggerSalesToProcurementHandler.execute(
        { quote_id: 'q-1', actor_id: 'user-1' } as never,
        context as never,
      ),
    ).toMatchObject({ success: false })
  })

  it('covers trigger sales->procurement success with supplier fallback creation', async () => {
    const { triggerSalesToProcurementHandler } = await import('@/lib/control/handlers/trigger-sales-to-procurement.handler')

    qLimit.push([])
    qInsertReturning.push([{ id: 'sup-new' }])
    mockExecute.mockResolvedValueOnce({ success: true, entity_id: 'ord-1' })
    mockExecute.mockResolvedValueOnce({ success: true, entity_id: 'po-1' })

    const result = await triggerSalesToProcurementHandler.execute(
      { quote_id: 'q-1', actor_id: 'user-1' } as never,
      context as never,
    )

    expect(result).toMatchObject({ success: true, status_after: 'READY_FOR_PO' })
    expect(mockExecute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'convert_quote_to_order', quote_id: 'q-1' }),
      context,
    )
    expect(mockExecute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: 'create_purchase_order', order_id: 'ord-1', vendor_id: 'sup-new' }),
      context,
    )
  })
})
