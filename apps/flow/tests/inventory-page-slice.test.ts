import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetInventoryAction,
  mockGetInventorySummaryAction,
  mockGetStockMovementsAction,
  mockGetLowStockAction,
  mockGetProductsAction,
} = vi.hoisted(() => ({
  mockGetInventoryAction: vi.fn(),
  mockGetInventorySummaryAction: vi.fn(),
  mockGetStockMovementsAction: vi.fn(),
  mockGetLowStockAction: vi.fn(),
  mockGetProductsAction: vi.fn(),
}))

vi.mock('@/app/actions/inventory', () => ({
  getInventoryAction: mockGetInventoryAction,
  getInventorySummaryAction: mockGetInventorySummaryAction,
  getStockMovementsAction: mockGetStockMovementsAction,
  getLowStockAction: mockGetLowStockAction,
}))

vi.mock('@/app/actions/products', () => ({
  getProductsAction: mockGetProductsAction,
}))

vi.mock('@/app/(dashboard)/inventory/inventory-actions', () => ({
  AdjustStockButton: ({ inventoryId }: { inventoryId: string }) =>
    React.createElement('button', { 'data-testid': 'adjust-stock' }, inventoryId),
  RecordMovementButton: ({ inventoryId }: { inventoryId: string }) =>
    React.createElement('button', { 'data-testid': 'record-movement' }, inventoryId),
}))

describe('inventory page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetInventoryAction.mockResolvedValue({
      rows: [
        {
          id: 'inv-1',
          productId: 'p-1',
          currentStock: 25,
          allocatedStock: 5,
          reorderPoint: 10,
          stockStatus: 'in_stock',
          location: 'A1',
        },
        {
          id: 'inv-2',
          productId: 'p-2',
          currentStock: 3,
          allocatedStock: 1,
          reorderPoint: 8,
          stockStatus: 'low_stock',
          location: null,
        },
      ],
      total: 2,
      limit: 100,
      offset: 0,
    })
    mockGetInventorySummaryAction.mockResolvedValue({
      totalProducts: 2,
      lowStockCount: 1,
      outOfStockCount: 0,
    })
    mockGetStockMovementsAction.mockResolvedValue({
      rows: [
        {
          id: 'mv-1',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
          productId: 'p-1',
          movementType: 'receipt',
          quantity: 10,
          reason: 'Initial stock',
        },
        {
          id: 'mv-2',
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
          productId: 'p-2',
          movementType: 'adjustment',
          quantity: -2,
          reason: null,
        },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    })
    mockGetLowStockAction.mockResolvedValue([
      { id: 'ls-1', productId: 'p-2', currentStock: 3 },
    ])
    mockGetProductsAction.mockResolvedValue({
      rows: [
        { id: 'p-1', name: 'Premium Box', sku: 'PB-001' },
        { id: 'p-2', name: 'Basic Box', sku: 'BB-001' },
      ],
      total: 2,
      limit: 500,
      offset: 0,
    })
  })

  it('renders populated inventory table, low-stock alerts, and recent movements', async () => {
    const { default: InventoryPage } = await import('@/app/(dashboard)/inventory/page')
    const markup = renderToStaticMarkup(await InventoryPage())

    expect(markup).toContain('Inventory')
    expect(markup).toContain('Total Products')
    expect(markup).toContain('Low Stock Alerts')
    expect(markup).toContain('Basic Box')
    expect(markup).toContain('Premium Box')
    expect(markup).toContain('In Stock')
    expect(markup).toContain('Low Stock')
    expect(markup).toContain('Recent Stock Movements')
    expect(markup).toContain('Receipt')
    expect(markup).toContain('Adjustment')
  })

  it('renders empty fallback when inventory/movements are unavailable', async () => {
    mockGetInventoryAction.mockResolvedValueOnce({ rows: [], total: 0, limit: 100, offset: 0 })
    mockGetInventorySummaryAction.mockResolvedValueOnce(null)
    mockGetStockMovementsAction.mockResolvedValueOnce({ rows: [], total: 0, limit: 20, offset: 0 })
    mockGetLowStockAction.mockResolvedValueOnce([])
    mockGetProductsAction.mockResolvedValueOnce({ rows: [], total: 0, limit: 500, offset: 0 })

    const { default: InventoryPage } = await import('@/app/(dashboard)/inventory/page')
    const markup = renderToStaticMarkup(await InventoryPage())

    expect(markup).toContain('No inventory yet')
    expect(markup).toContain('No movements recorded yet')
    expect(markup).not.toContain('Low Stock Alerts')
  })

  it('falls back to safe defaults when data fetch throws', async () => {
    mockGetInventoryAction.mockRejectedValueOnce(new Error('db down'))

    const { default: InventoryPage } = await import('@/app/(dashboard)/inventory/page')
    const markup = renderToStaticMarkup(await InventoryPage())

    expect(markup).toContain('No inventory yet')
    expect(markup).toContain('No movements recorded yet')
  })

  it('covers inventory and movement nullish fallback branches', async () => {
    mockGetInventoryAction.mockResolvedValueOnce({
      rows: [
        {
          id: 'inv-nullish',
          productId: null,
          currentStock: null,
          allocatedStock: null,
          reorderPoint: null,
          stockStatus: 'mystery',
          location: null,
        },
      ],
      total: 1,
      limit: 100,
      offset: 0,
    })
    mockGetInventorySummaryAction.mockResolvedValueOnce(null)
    mockGetLowStockAction.mockResolvedValueOnce([{ id: 'ls-unknown', productId: 'missing-product', currentStock: null }])
    mockGetProductsAction.mockResolvedValueOnce({
      rows: [
        { id: 'p-sku-only', name: null, sku: 'SKU-ONLY' },
        { id: 'p-unknown', name: null, sku: null },
      ],
      total: 2,
      limit: 500,
      offset: 0,
    })
    mockGetStockMovementsAction.mockResolvedValueOnce({
      rows: [
        {
          id: 'mv-nullish',
          createdAt: null,
          productId: null,
          movementType: null,
          quantity: 0,
          reason: null,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    })

    const { default: InventoryPage } = await import('@/app/(dashboard)/inventory/page')
    const markup = renderToStaticMarkup(await InventoryPage())

    expect(markup).toContain('Low Stock Alerts')
    expect(markup).toContain('Product')
    expect(markup).toContain('(0 left)')
    expect(markup).toContain('Unknown')
    expect(markup).toContain('—')
    expect(markup).toContain('Unknown')
  })
})
