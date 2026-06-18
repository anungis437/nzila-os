import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRevalidatePath,
  mockResolveOrgContext,
  mockCreateProduct,
  mockGetProduct,
  mockGetProductBySku,
  mockListProducts,
  mockUpdateProduct,
  mockDeleteProduct,
  mockRecordStockMovement,
  mockReserveStock,
  mockReleaseReservation,
  mockGetStockHistory,
  mockGetInventorySnapshot,
  mockGetLowStockProducts,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockCreateProduct: vi.fn(),
  mockGetProduct: vi.fn(),
  mockGetProductBySku: vi.fn(),
  mockListProducts: vi.fn(),
  mockUpdateProduct: vi.fn(),
  mockDeleteProduct: vi.fn(),
  mockRecordStockMovement: vi.fn(),
  mockReserveStock: vi.fn(),
  mockReleaseReservation: vi.fn(),
  mockGetStockHistory: vi.fn(),
  mockGetInventorySnapshot: vi.fn(),
  mockGetLowStockProducts: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mockRevalidatePath }))
vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext: mockResolveOrgContext }))
vi.mock('@/lib/inventory-service', () => ({
  createProduct: mockCreateProduct,
  getProduct: mockGetProduct,
  getProductBySku: mockGetProductBySku,
  listProducts: mockListProducts,
  updateProduct: mockUpdateProduct,
  deleteProduct: mockDeleteProduct,
  recordStockMovement: mockRecordStockMovement,
  reserveStock: mockReserveStock,
  releaseReservation: mockReleaseReservation,
  getStockHistory: mockGetStockHistory,
  getInventorySnapshot: mockGetInventorySnapshot,
  getLowStockProducts: mockGetLowStockProducts,
}))
vi.mock('@nzila/db', () => ({ commerceProducts: { $inferSelect: {} }, commerceStockMovements: { $inferSelect: {} } }))

describe('inventory actions slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })

    mockCreateProduct.mockResolvedValue({ id: 'prod-1', sku: 'SKU-1' })
    mockGetProduct.mockResolvedValue({ id: 'prod-1' })
    mockGetProductBySku.mockResolvedValue({ id: 'prod-1', sku: 'SKU-1' })
    mockListProducts.mockResolvedValue([{ id: 'prod-1' }])
    mockUpdateProduct.mockResolvedValue({ id: 'prod-1', name: 'Updated' })
    mockDeleteProduct.mockResolvedValue(undefined)
    mockRecordStockMovement.mockResolvedValue({ id: 'mv-1' })
    mockReserveStock.mockResolvedValue(true)
    mockReleaseReservation.mockResolvedValue(true)
    mockGetStockHistory.mockResolvedValue([{ id: 'mv-1' }])
    mockGetInventorySnapshot.mockResolvedValue({ totalProducts: 1 })
    mockGetLowStockProducts.mockResolvedValue([{ id: 'prod-2' }])
  })

  it('covers product action success and not-found branches', async () => {
    const mod = await import('@/lib/inventory-actions')

    expect((await mod.createProductAction({ sku: 'SKU-1', name: 'Paper', unitCost: 2, unitPrice: 5 })).success).toBe(true)
    expect((await mod.getProductAction('prod-1')).success).toBe(true)
    expect((await mod.getProductBySkuAction('SKU-1')).success).toBe(true)
    expect((await mod.listProductsAction({ search: 'paper' })).success).toBe(true)
    expect((await mod.updateProductAction('prod-1', { name: 'Paper Plus' })).success).toBe(true)
    expect((await mod.deleteProductAction('prod-1')).success).toBe(true)

    expect(mockGetProductBySku).toHaveBeenCalledWith('org-1', 'SKU-1')
    expect(mockListProducts).toHaveBeenCalledWith(expect.objectContaining({ orgId: 'org-1', search: 'paper' }))
    expect(mockRevalidatePath).toHaveBeenCalledWith('/products')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/inventory')

    mockGetProduct.mockResolvedValueOnce(null)
    expect(await mod.getProductAction('missing')).toEqual({ success: false, error: 'Product not found' })

    mockGetProductBySku.mockResolvedValueOnce(null)
    expect(await mod.getProductBySkuAction('missing')).toEqual({ success: false, error: 'Product not found' })

    mockUpdateProduct.mockResolvedValueOnce(null)
    expect(await mod.updateProductAction('missing', { name: 'Nope' })).toEqual({ success: false, error: 'Product not found' })
  })

  it('covers inventory action success branches and org/actor plumbing', async () => {
    const mod = await import('@/lib/inventory-actions')

    expect((await mod.recordStockMovementAction({ productId: 'prod-1', type: 'in', quantity: 2 })).success).toBe(true)
    expect((await mod.reserveStockAction({ productId: 'prod-1', quantity: 1, referenceType: 'order', referenceId: 'ord-1' })).success).toBe(true)
    expect((await mod.releaseReservationAction({ productId: 'prod-1', quantity: 1 })).success).toBe(true)
    expect((await mod.getStockHistoryAction('prod-1', 10)).success).toBe(true)
    expect((await mod.getInventorySnapshotAction()).success).toBe(true)
    expect((await mod.getLowStockProductsAction()).success).toBe(true)

    expect(mockRecordStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', userId: 'user-1', productId: 'prod-1', quantity: 2 }),
    )
    expect(mockGetInventorySnapshot).toHaveBeenCalledWith('org-1')
    expect(mockGetLowStockProducts).toHaveBeenCalledWith('org-1')
  })

  it('covers error fallback branches across product and inventory actions', async () => {
    const mod = await import('@/lib/inventory-actions')

    mockCreateProduct.mockRejectedValueOnce('boom')
    expect(await mod.createProductAction({ sku: 'S', name: 'N', unitCost: 1, unitPrice: 2 })).toEqual({
      success: false,
      error: 'Failed to create product',
    })

    mockListProducts.mockRejectedValueOnce(new Error('list failed'))
    expect(await mod.listProductsAction()).toEqual({ success: false, error: 'list failed' })

    mockGetProduct.mockRejectedValueOnce('boom')
    expect(await mod.getProductAction('prod-x')).toEqual({
      success: false,
      error: 'Failed to get product',
    })

    mockGetProductBySku.mockRejectedValueOnce('boom')
    expect(await mod.getProductBySkuAction('SKU-X')).toEqual({
      success: false,
      error: 'Failed to get product',
    })

    mockUpdateProduct.mockRejectedValueOnce('boom')
    expect(await mod.updateProductAction('prod-x', {} as never)).toEqual({
      success: false,
      error: 'Failed to update product',
    })

    mockDeleteProduct.mockRejectedValueOnce(new Error('delete failed'))
    expect(await mod.deleteProductAction('prod-x')).toEqual({ success: false, error: 'delete failed' })

    mockRecordStockMovement.mockRejectedValueOnce(new Error('movement failed'))
    expect(await mod.recordStockMovementAction({ productId: 'prod-1', type: 'out', quantity: 1 })).toEqual({
      success: false,
      error: 'movement failed',
    })

    mockReserveStock.mockRejectedValueOnce(new Error('reserve failed'))
    expect(await mod.reserveStockAction({ productId: 'prod-1', quantity: 1 })).toEqual({
      success: false,
      error: 'reserve failed',
    })

    mockReleaseReservation.mockRejectedValueOnce(new Error('release failed'))
    expect(await mod.releaseReservationAction({ productId: 'prod-1', quantity: 1 })).toEqual({
      success: false,
      error: 'release failed',
    })

    mockGetStockHistory.mockRejectedValueOnce(new Error('history failed'))
    expect(await mod.getStockHistoryAction('prod-1')).toEqual({ success: false, error: 'history failed' })

    mockGetInventorySnapshot.mockRejectedValueOnce(new Error('snapshot failed'))
    expect(await mod.getInventorySnapshotAction()).toEqual({ success: false, error: 'snapshot failed' })

    mockGetLowStockProducts.mockRejectedValueOnce(new Error('low-stock failed'))
    expect(await mod.getLowStockProductsAction()).toEqual({ success: false, error: 'low-stock failed' })
  })

  it('covers complementary error-message branches for all actions', async () => {
    const mod = await import('@/lib/inventory-actions')

    mockCreateProduct.mockRejectedValueOnce(new Error('create failed'))
    expect(await mod.createProductAction({ sku: 'S2', name: 'N2', unitCost: 1, unitPrice: 2 })).toEqual({
      success: false,
      error: 'create failed',
    })

    mockListProducts.mockRejectedValueOnce('boom')
    expect(await mod.listProductsAction()).toEqual({ success: false, error: 'Failed to list products' })

    mockGetProduct.mockRejectedValueOnce(new Error('get failed'))
    expect(await mod.getProductAction('prod-y')).toEqual({ success: false, error: 'get failed' })

    mockGetProductBySku.mockRejectedValueOnce(new Error('get sku failed'))
    expect(await mod.getProductBySkuAction('SKU-Y')).toEqual({ success: false, error: 'get sku failed' })

    mockUpdateProduct.mockRejectedValueOnce(new Error('update failed'))
    expect(await mod.updateProductAction('prod-y', {} as never)).toEqual({ success: false, error: 'update failed' })

    mockDeleteProduct.mockRejectedValueOnce('boom')
    expect(await mod.deleteProductAction('prod-y')).toEqual({ success: false, error: 'Failed to delete product' })

    mockRecordStockMovement.mockRejectedValueOnce('boom')
    expect(await mod.recordStockMovementAction({ productId: 'prod-y', type: 'in', quantity: 1 })).toEqual({
      success: false,
      error: 'Failed to record stock movement',
    })

    mockReserveStock.mockRejectedValueOnce('boom')
    expect(await mod.reserveStockAction({ productId: 'prod-y', quantity: 1 })).toEqual({
      success: false,
      error: 'Failed to reserve stock',
    })

    mockReleaseReservation.mockRejectedValueOnce('boom')
    expect(await mod.releaseReservationAction({ productId: 'prod-y', quantity: 1 })).toEqual({
      success: false,
      error: 'Failed to release reservation',
    })

    mockGetStockHistory.mockRejectedValueOnce('boom')
    expect(await mod.getStockHistoryAction('prod-y')).toEqual({ success: false, error: 'Failed to get stock history' })

    mockGetInventorySnapshot.mockRejectedValueOnce('boom')
    expect(await mod.getInventorySnapshotAction()).toEqual({ success: false, error: 'Failed to get inventory snapshot' })

    mockGetLowStockProducts.mockRejectedValueOnce('boom')
    expect(await mod.getLowStockProductsAction()).toEqual({
      success: false,
      error: 'Failed to get low stock products',
    })
  })
})
