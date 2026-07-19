import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockAuth,
  mockRedirect,
  mockQuoteFindAll,
  mockGetReadContext,
  mockGetOrdersAction,
  mockGetInvoicesAction,
  mockGetCustomersAction,
  mockGetProductsAction,
  mockGetLowStockAction,
  mockGetQuoteOutcomeCounts,
  mockGetTopWonSkus,
  mockCalculateAverageQuoteSize,
  mockCalculateCloseRateTrend,
  mockCalculateEstimatedMrr,
  mockEstimateCustomerLifetimeValue,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(async () => ({ userId: 'user-1' })),
  mockRedirect: vi.fn(),
  mockQuoteFindAll: vi.fn(async () => [
    { id: 'q-1', reference: 'QT-001', title: 'Quote One', status: 'draft', total: 1000, createdAt: '2026-06-06T00:00:00.000Z' },
    { id: 'q-2', reference: 'QT-002', title: 'Quote Two', status: 'accepted', total: 2500, createdAt: '2026-06-01T00:00:00.000Z' },
  ]),
  mockGetReadContext: vi.fn(async () => ({ orgId: 'org-1' })),
  mockGetOrdersAction: vi.fn(async () => ({ rows: [
    { id: 'o-1', total: 1800, status: 'created', quoteId: 'q-1' },
    { id: 'o-2', total: 2200, status: 'shipped', quoteId: 'q-2' },
  ] })),
  mockGetInvoicesAction: vi.fn(async () => ({ rows: [
    { id: 'i-1', total: 1800, amountDue: 1800, status: 'paid', issuedAt: '2026-06-03T00:00:00.000Z', createdAt: '2026-06-03T00:00:00.000Z' },
    { id: 'i-2', total: 1200, amountDue: 1200, status: 'overdue', issuedAt: '2026-05-30T00:00:00.000Z', createdAt: '2026-05-30T00:00:00.000Z' },
  ] })),
  mockGetCustomersAction: vi.fn(async () => ({ rows: [{ id: 'c-1' }, { id: 'c-2' }] })),
  mockGetProductsAction: vi.fn(async () => ({ rows: [{ id: 'p-1' }, { id: 'p-2' }, { id: 'p-3' }] })),
  mockGetLowStockAction: vi.fn(async () => [{ id: 'p-3' }]),
  mockGetQuoteOutcomeCounts: vi.fn(async () => ({ won: 1, lost: 0 })),
  mockGetTopWonSkus: vi.fn(async () => [{ sku: 'SKU-1', count: 3 }]),
  mockCalculateAverageQuoteSize: vi.fn(() => 1750),
  mockCalculateCloseRateTrend: vi.fn(() => ({ recentCloseRate: 50, deltaPoints: 5 })),
  mockCalculateEstimatedMrr: vi.fn(() => 4200),
  mockEstimateCustomerLifetimeValue: vi.fn(() => 9000),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mockAuth }))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))
vi.mock('@/lib/db', () => ({ quoteRepo: { findAll: mockQuoteFindAll } }))
vi.mock('@/lib/org-resolver', () => ({ getReadContext: mockGetReadContext }))
vi.mock('@/app/actions/orders', () => ({ getOrdersAction: mockGetOrdersAction }))
vi.mock('@/app/actions/invoices', () => ({ getInvoicesAction: mockGetInvoicesAction }))
vi.mock('@/app/actions/customers', () => ({ getCustomersAction: mockGetCustomersAction }))
vi.mock('@/app/actions/products', () => ({ getProductsAction: mockGetProductsAction }))
vi.mock('@/app/actions/inventory', () => ({ getLowStockAction: mockGetLowStockAction }))
vi.mock('@/lib/dashboard-aggregates', () => ({
  getQuoteOutcomeCounts: mockGetQuoteOutcomeCounts,
  getTopWonSkus: mockGetTopWonSkus,
}))
vi.mock('@/lib/commercial-insights', () => ({
  calculateAverageQuoteSize: mockCalculateAverageQuoteSize,
  calculateCloseRateTrend: mockCalculateCloseRateTrend,
  calculateEstimatedMrr: mockCalculateEstimatedMrr,
  estimateCustomerLifetimeValue: mockEstimateCustomerLifetimeValue,
}))
vi.mock('@/app/(locale)/dashboard/page', () => ({
  default: async function DashboardPage() {
    const actual = await import('@/app/[locale]/dashboard/page')
    return actual.default({ params: Promise.resolve({ locale: 'en-CA' }) } as never)
  },
}))

describe('locale dashboard page slice', () => {
  it('renders the dashboard page with mocked workspace data', async () => {
    const { default: DashboardPage } = await import('@/app/[locale]/dashboard/page')
    const element = await DashboardPage({ params: Promise.resolve({ locale: 'en-CA' }) } as never)
    const markup = renderToStaticMarkup(element as React.ReactElement)

    expect(markup).toContain('Dashboard')
    expect(markup).toContain('Quote Pipeline')
    expect(markup).toContain('Revenue')
    expect(markup).toContain('Win Rate')
    expect(markup).toContain('Active Clients')
    expect(markup).toContain('Recent Quotes')
    expect(markup).toContain('Order Pipeline')
    expect(markup).toContain('Collections')
    expect(markup).toContain('Quote-to-Cash Funnel')
    expect(markup).toContain('Quote Aging')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
