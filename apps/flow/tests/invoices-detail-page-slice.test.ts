import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockNotFound,
  mockGetInvoiceAction,
  mockGetInvoiceLinesAction,
  mockGetCustomerAction,
  mockGetOrderAction,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  mockGetInvoiceAction: vi.fn(),
  mockGetInvoiceLinesAction: vi.fn(),
  mockGetCustomerAction: vi.fn(),
  mockGetOrderAction: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mockGetLocale,
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/invoices', () => ({
  getInvoiceAction: mockGetInvoiceAction,
  getInvoiceLinesAction: mockGetInvoiceLinesAction,
}))

vi.mock('@/app/actions/customers', () => ({
  getCustomerAction: mockGetCustomerAction,
}))

vi.mock('@/app/actions/orders', () => ({
  getOrderAction: mockGetOrderAction,
}))

describe('invoice detail page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetInvoiceAction.mockResolvedValue({
      id: 'inv-1',
      ref: 'INV-001',
      status: 'overdue',
      customerId: 'c-1',
      orderId: 'o-1',
      subtotal: '1000',
      taxTotal: '149.75',
      total: '1149.75',
      amountPaid: '200',
      amountDue: '949.75',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: new Date('2026-06-02T00:00:00.000Z'),
      dueDate: new Date('2026-06-05T00:00:00.000Z'),
      paidAt: null,
      notes: 'Payable within 7 days',
    })
    mockGetInvoiceLinesAction.mockResolvedValue([
      { id: 'line-1', description: 'Premium service', quantity: 2, unitPrice: '250', lineTotal: '500' },
      { id: 'line-2', description: 'Setup fee', quantity: 1, unitPrice: '500', lineTotal: '500' },
    ])
    mockGetCustomerAction.mockResolvedValue({ id: 'c-1', name: 'Acme Inc', email: 'billing@acme.test' })
    mockGetOrderAction.mockResolvedValue({ id: 'o-1', ref: 'ORD-100' })
  })

  it('renders overdue invoice with payment controls, warning, and timeline', async () => {
    const { default: InvoiceDetailPage } = await import('@/app/(dashboard)/invoices/[id]/page')
    const markup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-1' }) }))

    expect(markup).toContain('Back to Invoices')
    expect(markup).toContain('INV-001')
    expect(markup).toContain('Payment Overdue')
    expect(markup).toContain('Outstanding balance')
    expect(markup).toContain('Record Payment')
    expect(markup).toContain('Send Reminder')
    expect(markup).toContain('ORD-100')
    expect(markup).toContain('Premium service')
    expect(markup).toContain('Setup fee')
    expect(markup).toContain('Balance Due')
    expect(markup).toContain('Timeline')
    expect(markup).toContain('Zoho Books')
    expect(markup).toContain('Sync to Zoho')
  })

  it('renders draft non-overdue branch with edit action and no payment warning block', async () => {
    mockGetInvoiceAction.mockResolvedValueOnce({
      id: 'inv-2',
      ref: 'INV-002',
      status: 'draft',
      customerId: 'c-2',
      orderId: null,
      subtotal: '100',
      taxTotal: '10',
      total: '110',
      amountPaid: '0',
      amountDue: '110',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: null,
      dueDate: null,
      paidAt: null,
      notes: '',
    })
    mockGetInvoiceLinesAction.mockResolvedValueOnce([])
    mockGetCustomerAction.mockResolvedValueOnce(null)

    const { default: InvoiceDetailPage } = await import('@/app/(dashboard)/invoices/[id]/page')
    const markup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-2' }) }))

    expect(markup).toContain('INV-002')
    expect(markup).toContain('Edit')
    expect(markup).not.toContain('Record Payment')
    expect(markup).not.toContain('Payment Overdue')
    expect(markup).not.toContain('Send Reminder')
    expect(markup).not.toContain('Balance Due')
  })

  it('covers residual invoice-detail status and boundary branches', async () => {
    const { default: InvoiceDetailPage } = await import('@/app/(dashboard)/invoices/[id]/page')

    mockGetInvoiceAction.mockResolvedValueOnce({
      id: 'inv-3',
      ref: 'INV-003',
      status: 'custom_status',
      customerId: 'c-3',
      orderId: null,
      subtotal: '0',
      taxTotal: '0',
      total: '0',
      amountPaid: '10',
      amountDue: '0',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: null,
      dueDate: null,
      paidAt: new Date('2026-06-03T00:00:00.000Z'),
      notes: null,
    })
    mockGetInvoiceLinesAction.mockResolvedValueOnce([])
    mockGetCustomerAction.mockResolvedValueOnce({ id: 'c-3', name: 'Fallback Co', email: null })

    const unknownStatusMarkup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-3' }) }))
    expect(unknownStatusMarkup).toContain('custom status')
    expect(unknownStatusMarkup).toContain('0%')
    expect(unknownStatusMarkup).toContain('Paid:')

    mockGetInvoiceAction.mockResolvedValueOnce({
      id: 'inv-4',
      ref: 'INV-004',
      status: 'issued',
      customerId: 'c-4',
      orderId: null,
      subtotal: '100',
      taxTotal: '0',
      total: '100',
      amountPaid: '100',
      amountDue: '0',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: new Date('2026-06-01T00:00:00.000Z'),
      dueDate: new Date('2099-01-01T00:00:00.000Z'),
      paidAt: null,
      notes: null,
    })
    mockGetInvoiceLinesAction.mockResolvedValueOnce([])
    mockGetCustomerAction.mockResolvedValueOnce({ id: 'c-4', name: 'Paid Co', email: null })

    const paidMarkup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-4' }) }))
    expect(paidMarkup).toContain('100%')
    expect(paidMarkup).toContain('text-green-500')

    mockGetInvoiceAction.mockResolvedValueOnce({
      id: 'inv-5',
      ref: 'INV-005',
      status: 'overdue',
      customerId: 'c-5',
      orderId: null,
      subtotal: '50',
      taxTotal: '0',
      total: '50',
      amountPaid: '0',
      amountDue: '50',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: null,
      dueDate: null,
      paidAt: null,
      notes: null,
    })
    mockGetInvoiceLinesAction.mockResolvedValueOnce([])
    mockGetCustomerAction.mockResolvedValueOnce({ id: 'c-5', name: 'Overdue Co', email: null })

    const overdueNoDateMarkup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-5' }) }))
    expect(overdueNoDateMarkup).toContain('This invoice was due on —')

    mockGetInvoiceAction.mockResolvedValueOnce({
      id: 'inv-6',
      ref: 'INV-006',
      status: 'issued',
      customerId: 'c-6',
      orderId: null,
      subtotal: '80',
      taxTotal: '0',
      total: '80',
      amountPaid: '0',
      amountDue: '0',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: null,
      dueDate: new Date('2020-01-01T00:00:00.000Z'),
      paidAt: null,
      notes: null,
    })
    mockGetInvoiceLinesAction.mockResolvedValueOnce([])
    mockGetCustomerAction.mockResolvedValueOnce({ id: 'c-6', name: 'No Due Co', email: null })
    const noDueMarkup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-6' }) }))
    expect(noDueMarkup).not.toContain('Payment Overdue')

    mockGetInvoiceAction.mockResolvedValueOnce({
      id: 'inv-7',
      ref: 'INV-007',
      status: 'paid',
      customerId: 'c-7',
      orderId: null,
      subtotal: '80',
      taxTotal: '0',
      total: '80',
      amountPaid: '80',
      amountDue: '10',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      issuedAt: null,
      dueDate: new Date('2020-01-01T00:00:00.000Z'),
      paidAt: new Date('2026-06-02T00:00:00.000Z'),
      notes: null,
    })
    mockGetInvoiceLinesAction.mockResolvedValueOnce([])
    mockGetCustomerAction.mockResolvedValueOnce({ id: 'c-7', name: 'Paid Late Co', email: null })
    const paidStatusMarkup = renderToStaticMarkup(await InvoiceDetailPage({ params: Promise.resolve({ id: 'inv-7' }) }))
    expect(paidStatusMarkup).not.toContain('Payment Overdue')
  })

  it('calls notFound when invoice is missing', async () => {
    mockGetInvoiceAction.mockResolvedValueOnce(null)

    const { default: InvoiceDetailPage } = await import('@/app/(dashboard)/invoices/[id]/page')
    await expect(InvoiceDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })
})
