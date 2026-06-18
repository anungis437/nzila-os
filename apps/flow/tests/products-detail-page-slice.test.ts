import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockNotFound,
  mockGetProductAction,
  mockGetInventoryAction,
  mockGetStockMovementsAction,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  mockGetProductAction: vi.fn(),
  mockGetInventoryAction: vi.fn(),
  mockGetStockMovementsAction: vi.fn(),
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

vi.mock('@/app/actions/products', () => ({
  getProductAction: mockGetProductAction,
}))

vi.mock('@/app/actions/inventory', () => ({
  getInventoryAction: mockGetInventoryAction,
  getStockMovementsAction: mockGetStockMovementsAction,
}))

describe('product detail page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetProductAction.mockResolvedValue({
      id: 'p-1',
      name: 'Premium Box',
      sku: 'PB-001',
      zohoItemId: 'zoho-123',
      description: 'A premium curated box',
      category: 'Gift Box',
      weightGrams: 450,
      dimensions: '30x20x10',
      supplierId: 's-1',
      costPrice: '10.00',
      basePrice: '20.00',
      status: 'active',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    })

    mockGetInventoryAction.mockResolvedValue({
      rows: [
        {
          id: 'inv-1',
          currentStock: 5,
          allocatedStock: 2,
          availableStock: 3,
          reorderPoint: 10,
          lastRestockedAt: new Date('2026-05-31T00:00:00.000Z'),
        },
      ],
    })

    mockGetStockMovementsAction.mockResolvedValue({
      rows: [
        {
          id: 'm-1',
          movementType: 'receipt',
          quantity: 10,
          reason: 'Initial stock',
          referenceId: 'ref-receipt',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
        {
          id: 'm-2',
          movementType: 'allocation',
          quantity: -2,
          reason: null,
          referenceId: null,
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
        },
        {
          id: 'm-3',
          movementType: 'adjustment',
          quantity: -1,
          reason: 'Stock count correction',
          referenceId: 'ref-adjustment',
          createdAt: new Date('2026-06-03T00:00:00.000Z'),
        },
        {
          id: 'm-4',
          movementType: 'return',
          quantity: 1,
          reason: 'Customer return',
          referenceId: 'ref-return',
          createdAt: new Date('2026-06-04T00:00:00.000Z'),
        },
      ],
    })
  })

  it('renders populated product detail with low-stock warning and movement variants', async () => {
    const { default: ProductDetailPage } = await import('@/app/(dashboard)/products/[id]/page')
    const markup = renderToStaticMarkup(await ProductDetailPage({ params: Promise.resolve({ id: 'p-1' }) }))

    expect(markup).toContain('Back to Products')
    expect(markup).toContain('Premium Box')
    expect(markup).toContain('PB-001')
    expect(markup).toContain('zoho-123')
    expect(markup).toContain('Low Stock')
    expect(markup).toContain('Create PO')
    expect(markup).toContain('Description')
    expect(markup).toContain('Pricing')
    expect(markup).toContain('Recent Stock Movements')
    expect(markup).toContain('Stock In')
    expect(markup).toContain('Allocated')
    expect(markup).toContain('Adjustment')
    expect(markup).toContain('Returned')
    expect(markup).toContain('View Supplier')
    expect(markup).toContain('Stock Value')
  })

  it('renders fallback/empty movement paths and out-of-stock branch', async () => {
    mockGetProductAction.mockResolvedValueOnce({
      id: 'p-2',
      name: 'Basic Box',
      sku: 'BB-001',
      zohoItemId: null,
      description: 'Basic box',
      category: 'Standard',
      weightGrams: null,
      dimensions: null,
      supplierId: null,
      costPrice: '8.00',
      basePrice: '12.00',
      status: 'inactive',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    })
    mockGetInventoryAction.mockResolvedValueOnce({ rows: [{ id: 'inv-2', currentStock: 0, allocatedStock: 0, reorderPoint: 5, lastRestockedAt: null }] })
    mockGetStockMovementsAction.mockResolvedValueOnce({ rows: [] })

    const { default: ProductDetailPage } = await import('@/app/(dashboard)/products/[id]/page')
    const markup = renderToStaticMarkup(await ProductDetailPage({ params: Promise.resolve({ id: 'p-2' }) }))

    expect(markup).toContain('Basic Box')
    expect(markup).toContain('Out of Stock')
    expect(markup).toContain('This product needs to be restocked immediately.')
    expect(markup).toContain('Recent Stock Movements')
    expect(markup).toContain('<tbody></tbody>')
    expect(markup).not.toContain('View Supplier')
  })

  it('covers in-stock style and nullish inventory fallbacks', async () => {
    mockGetProductAction.mockResolvedValueOnce({
      id: 'p-3',
      name: 'In Stock Box',
      sku: 'IS-001',
      zohoItemId: null,
      description: 'In stock product',
      category: 'Standard',
      weightGrams: null,
      dimensions: null,
      supplierId: null,
      costPrice: '0.00',
      basePrice: '12.00',
      status: 'active',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    })
    mockGetInventoryAction.mockResolvedValueOnce({ rows: [] })
    mockGetStockMovementsAction.mockResolvedValueOnce({ rows: [{ id: 'm-5', movementType: 'allocation', quantity: -1, reason: null, referenceId: null, createdAt: null }] })

    const { default: ProductDetailPage } = await import('@/app/(dashboard)/products/[id]/page')
    const markupFallback = renderToStaticMarkup(await ProductDetailPage({ params: Promise.resolve({ id: 'p-3' }) }))

    expect(markupFallback).toContain('Out of Stock')
    expect(markupFallback).toContain('$0.00')

    mockGetProductAction.mockResolvedValueOnce({
      id: 'p-4',
      name: 'High Stock Box',
      sku: 'HS-001',
      zohoItemId: null,
      description: 'High stock product',
      category: 'Standard',
      weightGrams: null,
      dimensions: null,
      supplierId: null,
      costPrice: '10.00',
      basePrice: '12.00',
      status: 'active',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    })
    mockGetInventoryAction.mockResolvedValueOnce({ rows: [{ id: 'inv-4', currentStock: 50, allocatedStock: 1, reorderPoint: 10, lastRestockedAt: null }] })
    mockGetStockMovementsAction.mockResolvedValueOnce({ rows: [] })

    const markupInStock = renderToStaticMarkup(await ProductDetailPage({ params: Promise.resolve({ id: 'p-4' }) }))
    expect(markupInStock).toContain('In Stock')
    expect(markupInStock).not.toContain('Low Stock Warning')
  })

  it('calls notFound when product does not exist', async () => {
    mockGetProductAction.mockResolvedValueOnce(null)

    const { default: ProductDetailPage } = await import('@/app/(dashboard)/products/[id]/page')
    await expect(ProductDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })
})
