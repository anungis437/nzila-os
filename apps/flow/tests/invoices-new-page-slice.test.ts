import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { mockPush, mockUseLocale } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseLocale: vi.fn(() => 'en-CA'),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next-intl', () => ({
  useLocale: mockUseLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/invoices', () => ({
  createInvoiceAction: vi.fn(),
}))

vi.mock('@/app/actions/customers', () => ({
  getCustomersAction: vi.fn(),
}))

vi.mock('@/app/actions/orders', () => ({
  getOrdersAction: vi.fn(),
  getOrderLinesAction: vi.fn(),
}))

describe('invoices new page slice', () => {
  it('renders the new invoice shell with the empty-state controls', async () => {
    const { default: NewInvoicePage } = await import('@/app/(dashboard)/invoices/new/page')
    const markup = renderToStaticMarkup(React.createElement(NewInvoicePage))

    expect(markup).toContain('Create Invoice')
    expect(markup).toContain('Create a new invoice for your customer. This will be synced to Zoho Books.')
    expect(markup).toContain('Back to Invoices')
    expect(markup).toContain('Invoice Details')
    expect(markup).toContain('Customer *')
    expect(markup).toContain('Order *')
    expect(markup).toContain('Issue Date *')
    expect(markup).toContain('Due Date *')
    expect(markup).toContain('Payment Terms')
    expect(markup).toContain('Notes')
    expect(markup).toContain('Line Items')
    expect(markup).toContain('No items added yet.')
    expect(markup).toContain('Add First Item')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Create Invoice')
    expect(markup).toContain('/en-CA/dashboard/invoices')
    expect(markup).toContain('Select customer first')
    expect(markup).toContain('disabled')
  })
})
