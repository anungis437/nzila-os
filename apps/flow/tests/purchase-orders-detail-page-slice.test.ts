import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockNotFound,
  mockGetPurchaseOrderWithLines,
  mockGetSupplier,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockNotFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  mockGetPurchaseOrderWithLines: vi.fn(),
  mockGetSupplier: vi.fn(),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mockGetLocale,
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}))

vi.mock('next/link', () => ({
  default: ({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/purchase-orders', () => ({
  getPurchaseOrderWithLinesAction: mockGetPurchaseOrderWithLines,
}))

vi.mock('@/app/actions/suppliers', () => ({
  getSupplierAction: mockGetSupplier,
}))

vi.mock('@/app/(dashboard)/purchase-orders/[id]/po-actions', () => ({
  POActions: ({ poId, status }: { poId: string; status: string }) => React.createElement('div', { 'data-testid': 'po-actions' }, `${poId}:${status}`),
}))

vi.mock('@/app/(dashboard)/components', () => ({
  StatusBadge: ({ status }: { status: string }) => React.createElement('span', { 'data-testid': 'status-badge' }, status),
  LifecycleTimeline: ({ events }: { events: Array<{ label: string }> }) =>
    React.createElement('div', { 'data-testid': 'timeline' }, events.map((e) => e.label).join('|')),
  SystemGuidance: ({ severity, children }: { severity: string; children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': `guidance-${severity}` }, children),
}))

describe('purchase order detail page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSupplier.mockResolvedValue({ id: 'sup-1', name: 'Northwind Supply' })
  })

  it('renders received progress, guidance, timeline, zoho synced and notes branches', async () => {
    mockGetPurchaseOrderWithLines.mockResolvedValueOnce({
      id: 'po-1',
      ref: 'PO-1001',
      supplierId: 'sup-1',
      status: 'partial_received',
      subtotal: '100',
      taxTotal: '15',
      total: '115',
      createdBy: 'ops@example.com',
      createdAt: '2026-06-01T00:00:00.000Z',
      sentAt: '2026-06-02T00:00:00.000Z',
      expectedDeliveryDate: '2026-06-07T00:00:00.000Z',
      actualDeliveryDate: null,
      zohoPoId: 'ZOHO-PO-1',
      notes: 'Handle with care',
      lines: [
        {
          id: 'line-1',
          productId: 'prod-1',
          description: 'Rice Bag',
          sku: 'RICE-001',
          quantity: 10,
          quantityReceived: 4,
          unitCost: '10',
          lineTotal: '100',
        },
      ],
    })

    const { default: PODetailPage } = await import('@/app/(dashboard)/purchase-orders/[id]/page')
    const markup = renderToStaticMarkup(await PODetailPage({ params: Promise.resolve({ id: 'po-1' }) }))

    expect(markup).toContain('PO-1001')
    expect(markup).toContain('Back to Purchase Orders')
    expect(markup).toContain('/en-CA/dashboard/purchase-orders')
    expect(markup).toContain('/en-CA/dashboard/suppliers/sup-1')
    expect(markup).toContain('Receiving Progress')
    expect(markup).toContain('40% received')
    expect(markup).toContain('4 of 10 items received')
    expect(markup).toContain('Expected:')
    expect(markup).toContain('Created|Sent to Supplier|Expected Delivery')
    expect(markup).toContain('Synced')
    expect(markup).toContain('ZOHO-PO-1')
    expect(markup).toContain('Handle with care')
    expect(markup).toContain('Continue receiving to complete')
  })

  it('renders fallback branches for unknown supplier, no zoho id, no receive progress, and unknown guidance', async () => {
    mockGetSupplier.mockResolvedValueOnce(null)
    mockGetPurchaseOrderWithLines.mockResolvedValueOnce({
      id: 'po-2',
      ref: 'PO-1002',
      supplierId: 'sup-missing',
      status: 'mystery_status',
      subtotal: '0',
      taxTotal: '0',
      total: '0',
      createdBy: 'ops@example.com',
      createdAt: '2026-06-01T00:00:00.000Z',
      sentAt: null,
      expectedDeliveryDate: null,
      actualDeliveryDate: '2026-06-10T00:00:00.000Z',
      zohoPoId: null,
      notes: null,
      lines: [
        {
          id: 'line-2',
          productId: null,
          description: 'Manual Item',
          sku: null,
          quantity: 0,
          quantityReceived: 0,
          unitCost: '0',
          lineTotal: '0',
        },
      ],
    })

    const { default: PODetailPage } = await import('@/app/(dashboard)/purchase-orders/[id]/page')
    const markup = renderToStaticMarkup(await PODetailPage({ params: Promise.resolve({ id: 'po-2' }) }))

    expect(markup).toContain('Supplier:')
    expect(markup).toContain('Unknown')
    expect(markup).toContain('Sync to Zoho')
    expect(markup).toContain('Received')
    expect(markup).not.toContain('Receiving Progress')
    expect(markup).not.toContain('data-testid="guidance-')
  })

  it('calls notFound branch when po does not exist', async () => {
    mockGetPurchaseOrderWithLines.mockResolvedValueOnce(null)

    const { default: PODetailPage } = await import('@/app/(dashboard)/purchase-orders/[id]/page')

    await expect(PODetailPage({ params: Promise.resolve({ id: 'missing-po' }) })).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('covers remaining guidance status variants and line nullish fallbacks', async () => {
    const { default: PODetailPage } = await import('@/app/(dashboard)/purchase-orders/[id]/page')

    const cases = [
      { status: 'draft', expected: 'Review line items and send to the supplier when ready.' },
      { status: 'sent', expected: 'Waiting for supplier acknowledgement.' },
      { status: 'acknowledged', expected: 'Supplier acknowledged. Begin receiving items as they arrive.' },
      { status: 'received', expected: 'All items received. This PO is complete.' },
      { status: 'cancelled', expected: 'This purchase order has been cancelled.' },
    ]

    for (const entry of cases) {
      mockGetPurchaseOrderWithLines.mockResolvedValueOnce({
        id: `po-${entry.status}`,
        ref: `PO-${entry.status}`,
        supplierId: 'sup-1',
        status: entry.status,
        subtotal: '0',
        taxTotal: '0',
        total: '0',
        createdBy: 'ops@example.com',
        createdAt: '2026-06-01T00:00:00.000Z',
        sentAt: entry.status === 'sent' ? '2026-06-02T00:00:00.000Z' : null,
        expectedDeliveryDate: entry.status === 'acknowledged' ? '2026-06-07T00:00:00.000Z' : null,
        actualDeliveryDate: entry.status === 'received' ? '2026-06-10T00:00:00.000Z' : null,
        zohoPoId: null,
        notes: null,
        lines: [
          {
            id: `line-${entry.status}`,
            productId: null,
            description: undefined,
            sku: null,
            quantity: entry.status === 'acknowledged' ? 10 : undefined,
            quantityReceived: entry.status === 'acknowledged' ? 0 : undefined,
            unitCost: '0',
            lineTotal: '0',
          },
        ],
      })

      const markup = renderToStaticMarkup(await PODetailPage({ params: Promise.resolve({ id: `po-${entry.status}` }) }))
      expect(markup).toContain(entry.expected)
    }

    mockGetPurchaseOrderWithLines.mockResolvedValueOnce({
      id: 'po-complete',
      ref: 'PO-100%',
      supplierId: 'sup-1',
      status: 'partial_received',
      subtotal: '100',
      taxTotal: '0',
      total: '100',
      createdBy: 'ops@example.com',
      createdAt: '2026-06-01T00:00:00.000Z',
      sentAt: null,
      expectedDeliveryDate: '2026-06-12T00:00:00.000Z',
      actualDeliveryDate: null,
      zohoPoId: null,
      notes: null,
      lines: [
        {
          id: 'line-complete',
          productId: null,
          description: 'Complete line',
          sku: null,
          quantity: 5,
          quantityReceived: 5,
          unitCost: '20',
          lineTotal: '100',
        },
      ],
    })

    const completeMarkup = renderToStaticMarkup(await PODetailPage({ params: Promise.resolve({ id: 'po-complete' }) }))
    expect(completeMarkup).toContain('100% received')
    expect(completeMarkup).toContain('bg-green-500')
  })
})
