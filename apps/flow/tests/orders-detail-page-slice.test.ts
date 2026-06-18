import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockNotFound,
  mockGetOrderAction,
  mockGetOrderLinesAction,
  mockGetCustomerAction,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  mockGetOrderAction: vi.fn(),
  mockGetOrderLinesAction: vi.fn(),
  mockGetCustomerAction: vi.fn(),
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

vi.mock('@/app/actions/orders', () => ({
  getOrderAction: mockGetOrderAction,
  getOrderLinesAction: mockGetOrderLinesAction,
}))

vi.mock('@/app/actions/customers', () => ({
  getCustomerAction: mockGetCustomerAction,
}))

vi.mock('@/app/(dashboard)/orders/[id]/order-actions', () => ({
  OrderActions: ({ orderId, status }: { orderId: string; status: string }) =>
    React.createElement('div', { 'data-testid': 'order-actions' }, `${orderId}:${status}`),
}))

vi.mock('@/app/(dashboard)/components', () => ({
  StatusBadge: ({ status }: { status: string }) => React.createElement('span', { 'data-testid': 'status-badge' }, status),
  ProgressStepper: ({ currentIndex }: { currentIndex: number }) => React.createElement('div', { 'data-testid': 'progress' }, String(currentIndex)),
  LifecycleTimeline: ({ events }: { events: Array<{ label: string }> }) => React.createElement('div', { 'data-testid': 'timeline' }, events.map((e) => e.label).join('|')),
  SystemGuidance: ({ severity, children }: { severity: string; children: React.ReactNode }) => React.createElement('div', { 'data-testid': `guidance-${severity}` }, children),
}))

describe('order detail page slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCustomerAction.mockResolvedValue({ id: 'c-1', name: 'Acme Inc', email: 'ops@acme.test' })
    mockGetOrderLinesAction.mockResolvedValue([
      { id: 'l-1', description: 'Starter Box', sku: 'SB-1', quantity: 3, unitPrice: '12.5', lineTotal: '37.5' },
      { id: 'l-2', description: 'Tea Kit', sku: null, quantity: 1, unitPrice: '20', lineTotal: '20' },
    ])
    mockGetOrderAction.mockResolvedValue({
      id: 'o-1',
      ref: 'ORD-001',
      status: 'confirmed',
      customerId: 'c-1',
      createdAt: '2026-06-01T00:00:00.000Z',
      orderLockedAt: '2026-06-02T00:00:00.000Z',
      total: '57.5',
      shippingAddress: {
        street: '1 Main St',
        city: 'Montreal',
        state: 'QC',
        postalCode: 'H2X 1Y4',
        country: 'Canada',
      },
      notes: 'Call before delivery.',
    })
  })

  it('renders populated order detail with timeline, shipping, and guidance', async () => {
    const { default: OrderDetailPage } = await import('@/app/(dashboard)/orders/[id]/page')
    const markup = renderToStaticMarkup(await OrderDetailPage({ params: Promise.resolve({ id: 'o-1' }) }))

    expect(markup).toContain('Back to Orders')
    expect(markup).toContain('ORD-001')
    expect(markup).toContain('Customer:')
    expect(markup).toContain('Acme Inc')
    expect(markup).toContain('/en-CA/dashboard/clients/c-1')
    expect(markup).toContain('Order Progress')
    expect(markup).toContain('data-testid="progress">1<')
    expect(markup).toContain('Order is confirmed. Create purchase orders or check production readiness.')
    expect(markup).toContain('Order Items')
    expect(markup).toContain('Starter Box')
    expect(markup).toContain('SB-1')
    expect(markup).toContain('Order Notes')
    expect(markup).toContain('Call before delivery.')
    expect(markup).toContain('Ship To')
    expect(markup).toContain('1 Main St')
    expect(markup).toContain('Created|Locked')
    expect(markup).toContain('Line Items')
    expect(markup).toContain('Total Units')
    expect(markup).toContain('$57.50')
  })

  it('covers remaining guidance statuses and fallback branches', async () => {
    const { default: OrderDetailPage } = await import('@/app/(dashboard)/orders/[id]/page')

    const guidanceCases = [
      { status: 'created', expected: 'Review line items and confirm this order to begin procurement.' },
      { status: 'fulfillment', expected: 'All materials received. Mark as shipped once packaging is complete.' },
      { status: 'shipped', expected: 'Shipment is in transit. Mark delivered once the customer confirms receipt.' },
      { status: 'delivered', expected: 'Customer has received the order. Complete to close.' },
      { status: 'cancelled', expected: 'This order has been cancelled.' },
    ]

    for (const item of guidanceCases) {
      mockGetOrderAction.mockResolvedValueOnce({
        id: `o-${item.status}`,
        ref: `ORD-${item.status}`,
        status: item.status,
        customerId: 'c-x',
        createdAt: '2026-06-01T00:00:00.000Z',
        orderLockedAt: null,
        total: '10',
        shippingAddress: null,
        notes: null,
      })
      mockGetOrderLinesAction.mockResolvedValueOnce([{ id: `l-${item.status}`, description: 'Item', sku: null, quantity: 1, unitPrice: '10', lineTotal: '10' }])
      mockGetCustomerAction.mockResolvedValueOnce(null)

      const markup = renderToStaticMarkup(await OrderDetailPage({ params: Promise.resolve({ id: `o-${item.status}` }) }))
      expect(markup).toContain(item.expected)
      expect(markup).toContain('Unknown')
      expect(markup).not.toContain('Ship To')
      expect(markup).not.toContain('Order Notes')
    }

    mockGetOrderAction.mockResolvedValueOnce({
      id: 'o-unknown',
      ref: 'ORD-UNKNOWN',
      status: 'mystery_status',
      customerId: 'c-x',
      createdAt: '2026-06-01T00:00:00.000Z',
      orderLockedAt: null,
      total: '5',
      shippingAddress: null,
      notes: null,
    })
    mockGetOrderLinesAction.mockResolvedValueOnce([{ id: 'l-unknown', description: 'Fallback Item', sku: null, quantity: 1, unitPrice: '5', lineTotal: '5' }])
    mockGetCustomerAction.mockResolvedValueOnce(null)

    const unknownMarkup = renderToStaticMarkup(await OrderDetailPage({ params: Promise.resolve({ id: 'o-unknown' }) }))
    expect(unknownMarkup).toContain('data-testid="progress">0<')
    expect(unknownMarkup).not.toContain('data-testid="guidance-')
  })

  it('calls notFound when order is missing', async () => {
    mockGetOrderAction.mockResolvedValueOnce(null)

    const { default: OrderDetailPage } = await import('@/app/(dashboard)/orders/[id]/page')
    await expect(OrderDetailPage({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })
})
