import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { mockPush, mockUseLocale, mockUseSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseLocale: vi.fn(() => 'en-CA'),
  mockUseSearchParams: vi.fn(() => ({ get: vi.fn(() => '') })),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: mockUseSearchParams,
}))

vi.mock('next-intl', () => ({
  useLocale: mockUseLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/purchase-orders', () => ({
  createPurchaseOrderAction: vi.fn(),
}))

vi.mock('@/app/actions/suppliers', () => ({
  getSuppliersAction: vi.fn(),
}))

vi.mock('@/app/actions/products', () => ({
  getProductsAction: vi.fn(),
}))

describe('purchase orders new page slice', () => {
  it('renders the new purchase order shell with the empty line-items state', async () => {
    const { default: NewPurchaseOrderPage } = await import('@/app/(dashboard)/purchase-orders/new/page')
    const markup = renderToStaticMarkup(React.createElement(NewPurchaseOrderPage))

    expect(markup).toContain('Create Purchase Order')
    expect(markup).toContain('Create a new PO to order inventory from your suppliers.')
    expect(markup).toContain('Back to Purchase Orders')
    expect(markup).toContain('Order Details')
    expect(markup).toContain('Supplier *')
    expect(markup).toContain('Expected Delivery Date')
    expect(markup).toContain('Notes')
    expect(markup).toContain('Line Items')
    expect(markup).toContain('No items added yet.')
    expect(markup).toContain('Add First Item')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Create PO')
    expect(markup).toContain('Select supplier')
    expect(markup).toContain('/en-CA/dashboard/purchase-orders')
  })
})
