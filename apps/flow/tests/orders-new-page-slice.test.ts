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

vi.mock('@/app/actions/orders', () => ({
  createOrderAction: vi.fn(),
  createOrderLineAction: vi.fn(),
  getOrderByRefAction: vi.fn(),
}))

vi.mock('@/app/actions/customers', () => ({
  getCustomersAction: vi.fn(),
}))

vi.mock('@/app/actions/products', () => ({
  getProductsAction: vi.fn(),
}))

describe('orders new page slice', () => {
  it('renders the new order shell with the empty line-items state', async () => {
    const { default: NewOrderPage } = await import('@/app/(dashboard)/orders/new/page')
    const markup = renderToStaticMarkup(React.createElement(NewOrderPage))

    expect(markup).toContain('Create Order')
    expect(markup).toContain('Create a new sales order for a customer.')
    expect(markup).toContain('Back to Orders')
    expect(markup).toContain('Order Details')
    expect(markup).toContain('Customer *')
    expect(markup).toContain('Notes')
    expect(markup).toContain('Line Items')
    expect(markup).toContain('No line items yet. Add products to this order.')
    expect(markup).toContain('Add Item')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Create Order')
    expect(markup).toContain('Select a customer...')
    expect(markup).toContain('/en-CA/dashboard/orders')
  })
})
