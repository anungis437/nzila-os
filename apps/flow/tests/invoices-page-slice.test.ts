import React from 'react'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockGetInvoices,
  mockGetCustomers,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockGetInvoices: vi.fn(),
  mockGetCustomers: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mockGetLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/invoices', () => ({
  getInvoicesAction: mockGetInvoices,
}))

vi.mock('@/app/actions/customers', () => ({
  getCustomersAction: mockGetCustomers,
}))

function isoDaysFrom(base: string, days: number): string {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

describe('invoices page slice', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-20T12:00:00.000Z'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCustomers.mockResolvedValue({
      rows: [
        { id: 'c-1', name: 'Acme Inc' },
        { id: 'c-2', name: 'Globex' },
      ],
    })
  })

  it('renders full invoice table with stats, aging buckets, and status fallbacks', async () => {
    const now = '2026-06-20T12:00:00.000Z'
    mockGetInvoices.mockResolvedValueOnce({
      rows: [
        { id: 'i-1', ref: 'INV-001', customerId: 'c-1', status: 'overdue', total: '1000', amountPaid: '200', dueDate: isoDaysFrom(now, -10), paidAt: null },
        { id: 'i-2', ref: 'INV-002', customerId: 'c-2', status: 'paid', total: '200', amountPaid: '200', dueDate: isoDaysFrom(now, -5), paidAt: isoDaysFrom(now, -1) },
        { id: 'i-3', ref: 'INV-003', customerId: 'c-1', status: 'draft', total: '80', amountPaid: '0', dueDate: null, paidAt: null },
        { id: 'i-4', ref: 'INV-004', customerId: 'c-2', status: 'issued', total: '300', amountPaid: '0', dueDate: isoDaysFrom(now, 2), paidAt: null },
        { id: 'i-5', ref: 'INV-005', customerId: 'c-1', status: 'issued', total: '500', amountPaid: '100', dueDate: isoDaysFrom(now, -45), paidAt: null },
        { id: 'i-6', ref: 'INV-006', customerId: 'c-2', status: 'issued', total: '700', amountPaid: '100', dueDate: isoDaysFrom(now, -75), paidAt: null },
        { id: 'i-7', ref: 'INV-007', customerId: 'c-missing', status: 'issued', total: '1200', amountPaid: '200', dueDate: isoDaysFrom(now, -120), paidAt: null },
        { id: 'i-8', ref: 'INV-008', customerId: 'c-1', status: 'strange_status', total: '50', amountPaid: '0', dueDate: isoDaysFrom(now, -1), paidAt: null },
      ],
    })

    const { default: InvoicesListPage } = await import('@/app/(dashboard)/invoices/page')
    const markup = renderToStaticMarkup(await InvoicesListPage())

    expect(markup).toContain('Invoices &amp; Payments')
    expect(markup).toContain('Sync with Zoho')
    expect(markup).toContain('New Invoice')
    expect(markup).toContain('/en-CA/dashboard/invoices/new')
    expect(markup).toContain('/en-CA/dashboard/invoices/reports')

    expect(markup).toContain('Total Outstanding')
    expect(markup).toContain('$3,150.00')
    expect(markup).toContain('Overdue (1)')
    expect(markup).toContain('$800.00')
    expect(markup).toContain('Paid This Month')
    expect(markup).toContain('$200.00')
    expect(markup).toContain('Draft Invoices')

    expect(markup).toContain('Current')
    expect(markup).toContain('1-30 Days')
    expect(markup).toContain('31-60 Days')
    expect(markup).toContain('61-90 Days')
    expect(markup).toContain('90+ Days')
    expect(markup).toContain('$380')
    expect(markup).toContain('$850')
    expect(markup).toContain('$400')
    expect(markup).toContain('$600')
    expect(markup).toContain('$1,000')

    expect(markup).toContain('INV-001')
    expect(markup).toContain('INV-008')
    expect(markup).toContain('Acme Inc')
    expect(markup).toContain('Unknown')
    expect(markup).toContain('strange status')
    expect(markup).toContain('Overdue')
    expect(markup).toContain('bg-gray-100 text-gray-600')
  }, 15000)

  it('renders empty state when no invoices exist', async () => {
    mockGetInvoices.mockResolvedValueOnce({ rows: [] })

    const { default: InvoicesListPage } = await import('@/app/(dashboard)/invoices/page')
    const markup = renderToStaticMarkup(await InvoicesListPage())

    expect(markup).toContain('No invoices found.')
    expect(markup).toContain('Create your first invoice')
  })
})
