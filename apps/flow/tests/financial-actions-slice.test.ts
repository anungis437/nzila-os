import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRevalidatePath,
  mockResolveOrgContext,
  mockExecuteCommandV2,
  mockGetInvoice,
  mockListInvoices,
  mockSendInvoice,
  mockRecordPayment,
  mockGetPaymentsByInvoice,
  mockGetFinancialSummary,
  mockGetAgingReport,
  mockGetRevenueRecognition,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockExecuteCommandV2: vi.fn(),
  mockGetInvoice: vi.fn(),
  mockListInvoices: vi.fn(),
  mockSendInvoice: vi.fn(),
  mockRecordPayment: vi.fn(),
  mockGetPaymentsByInvoice: vi.fn(),
  mockGetFinancialSummary: vi.fn(),
  mockGetAgingReport: vi.fn(),
  mockGetRevenueRecognition: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext: mockResolveOrgContext }))
vi.mock('@/lib/control/control-adapter', () => ({ executeCommandV2: mockExecuteCommandV2 }))
vi.mock('@/lib/financial-service', () => ({
  getInvoice: mockGetInvoice,
  listInvoices: mockListInvoices,
  sendInvoice: mockSendInvoice,
  recordPayment: mockRecordPayment,
  getPaymentsByInvoice: mockGetPaymentsByInvoice,
  getFinancialSummary: mockGetFinancialSummary,
  getAgingReport: mockGetAgingReport,
  getRevenueRecognition: mockGetRevenueRecognition,
}))
vi.mock('@nzila/db', () => ({ commerceInvoices: { $inferSelect: {} }, commercePayments: { $inferSelect: {} } }))

describe('financial actions slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1' })
    mockExecuteCommandV2.mockResolvedValue({ success: true, data: { entity_id: 'inv-1' } })
    mockGetInvoice.mockResolvedValue({ id: 'inv-1' })
    mockListInvoices.mockResolvedValue([{ id: 'inv-1' }])
    mockSendInvoice.mockResolvedValue({ id: 'inv-1', status: 'sent' })
    mockRecordPayment.mockResolvedValue({ id: 'pay-1' })
    mockGetPaymentsByInvoice.mockResolvedValue([{ id: 'pay-1' }])
    mockGetFinancialSummary.mockResolvedValue({ totalRevenue: 100 } as never)
    mockGetAgingReport.mockResolvedValue({ buckets: [] } as never)
    mockGetRevenueRecognition.mockResolvedValue({ recognizedRevenue: 50 } as never)
  })

  it('covers command-driven invoice actions success and failures', async () => {
    const mod = await import('@/lib/financial-actions')

    expect((await mod.createInvoiceFromOrderAction({ orderId: 'ord-1' })).success).toBe(true)
    expect((await mod.issueInvoiceAction('inv-1')).success).toBe(true)
    expect((await mod.voidInvoiceAction('inv-1', 'duplicate')).success).toBe(true)

    mockExecuteCommandV2.mockResolvedValueOnce({ success: false, error: 'create failed' })
    expect(await mod.createInvoiceFromOrderAction({ orderId: 'ord-2' })).toEqual({
      success: false,
      error: 'create failed',
    })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: false, error: 'issue failed' })
    expect(await mod.issueInvoiceAction('inv-2')).toEqual({ success: false, error: 'issue failed' })
  })

  it('covers invoice lookup/list and send/payment/report branches', async () => {
    const mod = await import('@/lib/financial-actions')

    expect((await mod.getInvoiceAction('inv-1')).success).toBe(true)
    expect((await mod.listInvoicesAction({ overdue: true })).success).toBe(true)
    expect((await mod.sendInvoiceAction('inv-1')).success).toBe(true)
    expect((await mod.recordPaymentAction({ invoiceId: 'inv-1', amount: 5, method: 'card' })).success).toBe(true)
    expect((await mod.getPaymentsByInvoiceAction('inv-1')).success).toBe(true)
    expect((await mod.getFinancialSummaryAction()).success).toBe(true)
    expect((await mod.getAgingReportAction()).success).toBe(true)
    expect((await mod.getRevenueRecognitionAction()).success).toBe(true)

    mockGetInvoice.mockResolvedValueOnce(null)
    expect(await mod.getInvoiceAction('missing')).toEqual({ success: false, error: 'Invoice not found' })

    mockSendInvoice.mockRejectedValueOnce(new Error('send failed'))
    expect((await mod.sendInvoiceAction('inv-2')).success).toBe(false)

    mockGetFinancialSummary.mockRejectedValueOnce(new Error('summary failed'))
    expect(await mod.getFinancialSummaryAction()).toEqual({ success: false, error: 'summary failed' })
  })

  it('covers remaining action error and default-date branches', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-09T00:00:00.000Z'))

    const mod = await import('@/lib/financial-actions')

    mockExecuteCommandV2.mockResolvedValueOnce({ success: true, data: {} })
    expect(await mod.createInvoiceFromOrderAction({ orderId: 'ord-3' })).toEqual({ success: true, data: undefined })

    mockExecuteCommandV2.mockResolvedValueOnce({ success: false, error: 'void failed' })
    expect(await mod.voidInvoiceAction('inv-void')).toEqual({ success: false, error: 'void failed' })

    mockListInvoices.mockRejectedValueOnce(new Error('list failed'))
    expect(await mod.listInvoicesAction()).toEqual({ success: false, error: 'list failed' })

    mockRecordPayment.mockRejectedValueOnce(new Error('payment failed'))
    expect(await mod.recordPaymentAction({ invoiceId: 'inv-4', amount: 2, method: 'cash' })).toEqual({
      success: false,
      error: 'payment failed',
    })

    mockGetPaymentsByInvoice.mockRejectedValueOnce(new Error('payments failed'))
    expect(await mod.getPaymentsByInvoiceAction('inv-4')).toEqual({ success: false, error: 'payments failed' })

    mockGetAgingReport.mockRejectedValueOnce(new Error('aging failed'))
    expect(await mod.getAgingReportAction()).toEqual({ success: false, error: 'aging failed' })

    mockGetRevenueRecognition.mockRejectedValueOnce(new Error('revenue failed'))
    expect(await mod.getRevenueRecognitionAction()).toEqual({
      success: false,
      error: 'revenue failed',
    })

    await mod.getFinancialSummaryAction()
    const [summaryOrgId, summaryFrom, summaryTo] = mockGetFinancialSummary.mock.calls.at(-1) as [string, Date, Date]
    expect(summaryOrgId).toBe('org-1')
    expect(summaryFrom.getFullYear()).toBe(2026)
    expect(summaryFrom.getMonth()).toBe(0)
    expect(summaryFrom.getDate()).toBe(1)
    expect(summaryTo.toISOString()).toBe('2026-06-09T00:00:00.000Z')

    await mod.getRevenueRecognitionAction({ from: '2026-02-01', to: '2026-02-28' })
    expect(mockGetRevenueRecognition).toHaveBeenCalledWith('org-1', new Date('2026-02-01'), new Date('2026-02-28'))

    vi.useRealTimers()
  })

  it('covers non-Error fallback messages across catch handlers', async () => {
    const mod = await import('@/lib/financial-actions')

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.getInvoiceAction('inv-x')).toEqual({ success: false, error: 'Failed to get invoice' })

    mockResolveOrgContext.mockResolvedValueOnce({ orgId: 'org-1' })
    mockListInvoices.mockRejectedValueOnce('boom')
    expect(await mod.listInvoicesAction()).toEqual({ success: false, error: 'Failed to list invoices' })

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.sendInvoiceAction('inv-x')).toEqual({ success: false, error: 'Failed to send invoice' })

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.recordPaymentAction({ invoiceId: 'inv-x', amount: 1, method: 'cash' })).toEqual({
      success: false,
      error: 'Failed to record payment',
    })

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.getPaymentsByInvoiceAction('inv-x')).toEqual({
      success: false,
      error: 'Failed to get payments',
    })

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.getFinancialSummaryAction()).toEqual({
      success: false,
      error: 'Failed to get financial summary',
    })

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.getAgingReportAction()).toEqual({ success: false, error: 'Failed to get aging report' })

    mockResolveOrgContext.mockRejectedValueOnce('boom')
    expect(await mod.getRevenueRecognitionAction()).toEqual({
      success: false,
      error: 'Failed to get revenue recognition report',
    })
  })
})
