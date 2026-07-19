import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveOrgContext,
  mockExecuteCommandV2,
  mockRevalidatePath,
  mockCreatePurchaseOrder,
  mockGetPurchaseOrder,
  mockListPurchaseOrders,
  mockUpdatePurchaseOrder,
  mockCancelPurchaseOrder,
  mockReceivePOLine,
  mockGetPOSummary,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockResolveOrgContext: vi.fn(),
  mockExecuteCommandV2: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCreatePurchaseOrder: vi.fn(),
  mockGetPurchaseOrder: vi.fn(),
  mockListPurchaseOrders: vi.fn(),
  mockUpdatePurchaseOrder: vi.fn(),
  mockCancelPurchaseOrder: vi.fn(),
  mockReceivePOLine: vi.fn(),
  mockGetPOSummary: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext: mockResolveOrgContext }))
vi.mock('@/lib/control/control-adapter', () => ({ executeCommandV2: mockExecuteCommandV2 }))
vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/po-service', () => ({
  createPurchaseOrder: mockCreatePurchaseOrder,
  getPurchaseOrder: mockGetPurchaseOrder,
  listPurchaseOrders: mockListPurchaseOrders,
  updatePurchaseOrder: mockUpdatePurchaseOrder,
  cancelPurchaseOrder: mockCancelPurchaseOrder,
  receivePOLine: mockReceivePOLine,
  getPOSummary: mockGetPOSummary,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() } }))

describe('po actions slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })
    mockExecuteCommandV2.mockResolvedValue({ success: true })
    mockCreatePurchaseOrder.mockResolvedValue({ id: 'po-1' })
    mockGetPurchaseOrder.mockResolvedValue({ id: 'po-1' })
    mockListPurchaseOrders.mockResolvedValue([{ id: 'po-1' }])
    mockUpdatePurchaseOrder.mockResolvedValue({ id: 'po-1', notes: 'updated' })
    mockCancelPurchaseOrder.mockResolvedValue({ id: 'po-1', status: 'cancelled' })
    mockReceivePOLine.mockResolvedValue({ id: 'line-1', quantityReceived: 3 })
    mockGetPOSummary.mockResolvedValue({ totalPOs: 1 })
  })

  it('covers create/get/list/update/cancel/receive/summary success paths', async () => {
    const mod = await import('@/lib/po-actions')

    expect(
      await mod.createPOAction({
        supplierId: 'sup-1',
        lines: [{ description: 'paper', quantity: 2, unitCost: 10 }],
        expectedDeliveryDate: '2026-07-01',
        shippingCost: 12,
      }),
    ).toMatchObject({ success: true, data: { id: 'po-1' } })

    expect(await mod.getPOAction('po-1')).toMatchObject({ success: true, data: { id: 'po-1' } })

    expect(
      await mod.listPOsAction({
        status: 'draft',
        supplierId: 'sup-1',
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        search: 'paper',
      }),
    ).toMatchObject({ success: true, data: [{ id: 'po-1' }] })

    expect(
      await mod.updatePOAction('po-1', {
        notes: 'updated',
        expectedDeliveryDate: '2026-07-08',
        shippingCost: 20,
        status: 'sent',
      }),
    ).toMatchObject({ success: true, data: { id: 'po-1' } })

    expect(await mod.cancelPOAction('po-1')).toMatchObject({ success: true, data: { id: 'po-1' } })

    expect(await mod.receivePOLineAction({ lineId: 'line-1', quantityReceived: 3, notes: 'received' })).toEqual({
      success: true,
      data: { lineId: 'line-1', quantityReceived: 3 },
    })

    expect(await mod.getPOSummaryAction({ fromDate: '2026-01-01', toDate: '2026-01-31' })).toMatchObject({
      success: true,
      data: { totalPOs: 1 },
    })

    expect(mockCreatePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', createdBy: 'user-1', expectedDeliveryDate: expect.any(Date) }),
    )
    expect(mockListPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', fromDate: expect.any(Date), toDate: expect.any(Date) }),
    )
    expect(mockUpdatePurchaseOrder).toHaveBeenCalledWith(
      'po-1',
      expect.objectContaining({ expectedDeliveryDate: expect.any(Date), status: 'sent' }),
    )
    expect(mockReceivePOLine).toHaveBeenCalledWith(
      expect.objectContaining({ lineId: 'line-1', quantityReceived: 3, receivedBy: 'user-1' }),
    )
    expect(mockGetPOSummary).toHaveBeenCalledWith('org-1', new Date('2026-01-01'), new Date('2026-01-31'))
  })

  it('covers command success and failure branches for sendPOAction', async () => {
    const mod = await import('@/lib/po-actions')

    expect(await mod.sendPOAction('po-1')).toEqual({ success: true, data: null })
    expect(mockExecuteCommandV2).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'send_purchase_order', purchase_order_id: 'po-1' }),
    )

    mockExecuteCommandV2.mockResolvedValueOnce({ success: false, error: 'send failed' })
    expect(await mod.sendPOAction('po-2')).toEqual({ success: false, error: 'send failed' })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: false })
    expect(await mod.sendPOAction('po-3')).toEqual({ success: false, error: 'Command failed' })
  })

  it('covers catch/fallback error branches for all try-catch actions', async () => {
    const mod = await import('@/lib/po-actions')

    mockCreatePurchaseOrder.mockRejectedValueOnce('boom')
    expect(await mod.createPOAction({ supplierId: 'sup-1', lines: [{ description: 'x', quantity: 1, unitCost: 1 }] })).toEqual({
      success: false,
      error: 'Unknown error',
    })

    mockGetPurchaseOrder.mockRejectedValueOnce(new Error('get failed'))
    expect(await mod.getPOAction('po-x')).toEqual({ success: false, error: 'get failed' })

    mockListPurchaseOrders.mockRejectedValueOnce(new Error('list failed'))
    expect(await mod.listPOsAction({})).toEqual({ success: false, error: 'list failed' })

    mockUpdatePurchaseOrder.mockRejectedValueOnce(new Error('update failed'))
    expect(await mod.updatePOAction('po-x', {})).toEqual({ success: false, error: 'update failed' })

    mockCancelPurchaseOrder.mockRejectedValueOnce(new Error('cancel failed'))
    expect(await mod.cancelPOAction('po-x')).toEqual({ success: false, error: 'cancel failed' })

    mockReceivePOLine.mockRejectedValueOnce(new Error('receive failed'))
    expect(await mod.receivePOLineAction({ lineId: 'line-x', quantityReceived: 1 })).toEqual({
      success: false,
      error: 'receive failed',
    })

    mockGetPOSummary.mockRejectedValueOnce(new Error('summary failed'))
    expect(await mod.getPOSummaryAction({})).toEqual({ success: false, error: 'summary failed' })

    expect(mockLoggerError).toHaveBeenCalled()
  })
})
