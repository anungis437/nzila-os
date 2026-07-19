import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockResolveOrgContext,
  mockRevalidatePath,
  mockCreateSupplier,
  mockGetSupplier,
  mockListSuppliers,
  mockUpdateSupplier,
  mockDeleteSupplier,
} = vi.hoisted(() => ({
  mockResolveOrgContext: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockCreateSupplier: vi.fn(),
  mockGetSupplier: vi.fn(),
  mockListSuppliers: vi.fn(),
  mockUpdateSupplier: vi.fn(),
  mockDeleteSupplier: vi.fn(),
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgContext: mockResolveOrgContext,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

vi.mock('@/lib/supplier-service', () => ({
  createSupplier: mockCreateSupplier,
  getSupplier: mockGetSupplier,
  listSuppliers: mockListSuppliers,
  updateSupplier: mockUpdateSupplier,
  deleteSupplier: mockDeleteSupplier,
}))

vi.mock('@nzila/db', () => ({
  commerceSuppliers: { $inferSelect: {} },
}))

describe('supplier actions and integration error slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1' })
    mockCreateSupplier.mockResolvedValue({ id: 'sup-1' })
    mockGetSupplier.mockResolvedValue({ id: 'sup-1', stats: {} })
    mockListSuppliers.mockResolvedValue([{ id: 'sup-1' }])
    mockUpdateSupplier.mockResolvedValue({ id: 'sup-1', name: 'Updated' })
    mockDeleteSupplier.mockResolvedValue(undefined)
  })

  it('supplier actions cover success, not-found, and error branches', async () => {
    const mod = await import('@/lib/supplier-actions')

    expect((await mod.createSupplierAction({ name: 'A' } as never)).success).toBe(true)
    expect(await mod.getSupplierAction('sup-1')).toEqual({ success: true, data: { id: 'sup-1', stats: {} } })
    expect((await mod.listSuppliersAction({ search: 'A' })).success).toBe(true)
    expect((await mod.updateSupplierAction('sup-1', { name: 'B' })).success).toBe(true)
    expect(await mod.deleteSupplierAction('sup-1')).toEqual({ success: true, data: true })

    mockGetSupplier.mockResolvedValueOnce(null)
    expect(await mod.getSupplierAction('missing')).toEqual({ success: false, error: 'Supplier not found' })

    mockUpdateSupplier.mockResolvedValueOnce(null)
    expect(await mod.updateSupplierAction('missing', {} as never)).toEqual({ success: false, error: 'Supplier not found' })

    expect(await mod.syncSupplierToZohoAction('sup-1')).toEqual({
      success: false,
      error: 'Zoho sync not configured. Please connect your Zoho account.',
    })

    mockCreateSupplier.mockRejectedValueOnce(new Error('create failed'))
    expect((await mod.createSupplierAction({ name: 'X' } as never)).success).toBe(false)

    mockListSuppliers.mockRejectedValueOnce(new Error('list failed'))
    expect((await mod.listSuppliersAction()).success).toBe(false)

    mockDeleteSupplier.mockRejectedValueOnce(new Error('delete failed'))
    expect((await mod.deleteSupplierAction('sup-2')).success).toBe(false)
  })

  it('integration dispatch error class includes code and message details', async () => {
    const { IntegrationDispatchError } = await import('@/lib/control/errors/integration-dispatch-error')

    const errWithCause = new IntegrationDispatchError('shopify', 'pushOrder', 'timeout')
    expect(errWithCause.code).toBe('INTEGRATION_DISPATCH_ERROR')
    expect(errWithCause.message).toContain('shopify.pushOrder')
    expect(errWithCause.message).toContain('timeout')

    const errWithoutCause = new IntegrationDispatchError('zoho', 'sync')
    expect(errWithoutCause.message).toContain('zoho.sync')
  })

  it('covers fallback error messages and Zoho sync catch branch', async () => {
    const mod = await import('@/lib/supplier-actions')

    mockCreateSupplier.mockRejectedValueOnce('boom')
    expect(await mod.createSupplierAction({ name: 'Fallback' } as never)).toEqual({
      success: false,
      error: 'Failed to create supplier',
    })

    mockGetSupplier.mockRejectedValueOnce('boom')
    expect(await mod.getSupplierAction('sup-x')).toEqual({
      success: false,
      error: 'Failed to get supplier',
    })

    mockListSuppliers.mockRejectedValueOnce('boom')
    expect(await mod.listSuppliersAction()).toEqual({
      success: false,
      error: 'Failed to list suppliers',
    })

    mockUpdateSupplier.mockRejectedValueOnce('boom')
    expect(await mod.updateSupplierAction('sup-x', {} as never)).toEqual({
      success: false,
      error: 'Failed to update supplier',
    })

    mockDeleteSupplier.mockRejectedValueOnce('boom')
    expect(await mod.deleteSupplierAction('sup-x')).toEqual({
      success: false,
      error: 'Failed to delete supplier',
    })

    mockResolveOrgContext.mockRejectedValueOnce('no context')
    await expect(mod.syncSupplierToZohoAction('sup-x')).rejects.toBe('no context')
  })
})
