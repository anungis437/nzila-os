import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockNotFound,
  mockGetSupplierAction,
  mockGetPurchaseOrdersAction,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  mockGetSupplierAction: vi.fn(),
  mockGetPurchaseOrdersAction: vi.fn(),
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

vi.mock('@/app/actions/suppliers', () => ({
  getSupplierAction: mockGetSupplierAction,
}))

vi.mock('@/app/actions/purchase-orders', () => ({
  getPurchaseOrdersAction: mockGetPurchaseOrdersAction,
}))

describe('supplier detail page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockGetSupplierAction.mockResolvedValue({
      id: 'sup-1-abcdef12',
      name: 'Northwind Supply',
      zohoVendorId: 'zoho-v-1',
      email: 'supply@northwind.test',
      phone: '+1-555-0100',
      contactName: 'Nina Buyer',
      address: {
        street: '10 Warehouse Ave',
        city: 'Montreal',
        state: 'QC',
        postalCode: 'H2X 1Y4',
        country: 'Canada',
      },
      notes: 'Preferred packaging on pallets.',
      status: 'active',
      paymentTerms: 'Net 30',
      leadTimeDays: 7,
      rating: 4,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
    })

    mockGetPurchaseOrdersAction.mockResolvedValue({
      rows: [
        {
          id: 'po-1',
          ref: 'PO-001',
          status: 'received',
          total: '1200',
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
        },
        {
          id: 'po-2',
          ref: 'PO-002',
          status: 'sent',
          total: '300',
          createdAt: new Date('2026-06-03T00:00:00.000Z'),
        },
      ],
    })
  })

  it('renders populated supplier detail with synced status and recent POs', async () => {
    const { default: SupplierDetailPage } = await import('@/app/(dashboard)/suppliers/[id]/page')
    const markup = renderToStaticMarkup(await SupplierDetailPage({ params: Promise.resolve({ id: 'sup-1' }) }))

    expect(markup).toContain('Back to Suppliers')
    expect(markup).toContain('Northwind Supply')
    expect(markup).toContain('Synced with Zoho')
    expect(markup).toContain('Zoho ID:')
    expect(markup).toContain('zoho-v-1')
    expect(markup).toContain('/en-CA/dashboard/suppliers/sup-1/edit')
    expect(markup).toContain('Contact Information')
    expect(markup).toContain('supply@northwind.test')
    expect(markup).toContain('+1-555-0100')
    expect(markup).toContain('Nina Buyer')
    expect(markup).toContain('10 Warehouse Ave')
    expect(markup).toContain('Recent Purchase Orders')
    expect(markup).toContain('PO-001')
    expect(markup).toContain('PO-002')
    expect(markup).toContain('/en-CA/dashboard/purchase-orders/po-1')
    expect(markup).toContain('Notes')
    expect(markup).toContain('Preferred packaging on pallets.')
    expect(markup).toContain('active')
    expect(markup).toContain('Net 30')
    expect(markup).toContain('7 days')
    expect(markup).toContain('4/5')
    expect(markup).toContain('$1,500')
    expect(markup).toContain('1')
  })

  it('renders pending/fallback branches for missing contact fields and empty PO state', async () => {
    mockGetSupplierAction.mockResolvedValueOnce({
      id: 'sup-2-xyz',
      name: 'Fallback Supplier',
      zohoVendorId: null,
      email: null,
      phone: null,
      contactName: null,
      address: 'legacy-address-string',
      notes: null,
      status: 'inactive',
      paymentTerms: null,
      leadTimeDays: 0,
      rating: null,
      createdAt: null,
      updatedAt: null,
    })
    mockGetPurchaseOrdersAction.mockResolvedValueOnce({ rows: [] })

    const { default: SupplierDetailPage } = await import('@/app/(dashboard)/suppliers/[id]/page')
    const markup = renderToStaticMarkup(await SupplierDetailPage({ params: Promise.resolve({ id: 'sup-2' }) }))

    expect(markup).toContain('Fallback Supplier')
    expect(markup).toContain('Sync Pending')
    expect(markup).not.toContain('Zoho ID:')
    expect(markup).toContain('No purchase orders yet.')
    expect(markup).toContain('Not specified')
    expect(markup).toContain('—')
    expect(markup).toContain('inactive')
    expect(markup).not.toContain('<h2 class="text-lg font-semibold text-navy mb-3">Notes</h2>')
  })

  it('renders purchase order date fallback when createdAt is null', async () => {
    mockGetSupplierAction.mockResolvedValueOnce({
      id: 'sup-3-date',
      name: 'Date Fallback Supplier',
      zohoVendorId: null,
      email: null,
      phone: null,
      contactName: null,
      address: null,
      notes: null,
      status: 'active',
      paymentTerms: null,
      leadTimeDays: 2,
      rating: null,
      createdAt: null,
      updatedAt: null,
    })
    mockGetPurchaseOrdersAction.mockResolvedValueOnce({
      rows: [
        {
          id: 'po-null-date',
          ref: 'PO-ND',
          status: 'sent',
          total: '1',
          createdAt: null,
        },
      ],
    })

    const { default: SupplierDetailPage } = await import('@/app/(dashboard)/suppliers/[id]/page')
    const markup = renderToStaticMarkup(await SupplierDetailPage({ params: Promise.resolve({ id: 'sup-3-date' }) }))

    expect(markup).toContain('PO-ND')
    expect(markup).toContain('—')
  })

  it('calls notFound when supplier does not exist', async () => {
    mockGetSupplierAction.mockResolvedValueOnce(null)

    const { default: SupplierDetailPage } = await import('@/app/(dashboard)/suppliers/[id]/page')
    await expect(SupplierDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })
})
