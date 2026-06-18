import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockGetOrdersAction,
  mockGetCustomersAction,
  mockGetInvoicesAction,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(async () => 'en-CA'),
  mockGetOrdersAction: vi.fn(async () => ({
    rows: [
      { id: 'o-1', customerId: 'c-1', status: 'confirmed', total: 1000, createdAt: '2026-06-03T00:00:00.000Z' },
      { id: 'o-2', customerId: 'c-2', status: 'in_production', total: 500, createdAt: '2026-05-20T00:00:00.000Z' },
      { id: 'o-3', customerId: 'c-1', status: 'shipped', total: 750, createdAt: '2026-06-06T00:00:00.000Z' },
    ],
  })),
  mockGetCustomersAction: vi.fn(async () => ({
    rows: [
      { id: 'c-1', name: 'Acme Industries' },
      { id: 'c-2', company: 'Beta Co' },
    ],
  })),
  mockGetInvoicesAction: vi.fn(async () => ({
    rows: [
      { id: 'i-1', status: 'paid', total: 600 },
      { id: 'i-2', status: 'open', total: 200 },
    ],
  })),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mockGetLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/orders', () => ({ getOrdersAction: mockGetOrdersAction }))
vi.mock('@/app/actions/customers', () => ({ getCustomersAction: mockGetCustomersAction }))
vi.mock('@/app/actions/invoices', () => ({ getInvoicesAction: mockGetInvoicesAction }))

describe('analytics page slice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-08T12:00:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the analytics dashboard with KPI, pipeline, client, and trend sections', async () => {
    const { default: AnalyticsPage } = await import('@/app/(dashboard)/analytics/page')
    const markup = renderToStaticMarkup(await AnalyticsPage())

    expect(markup).toContain('Analytics')
    expect(markup).toContain('Sales performance, revenue trends, and client insights.')
    expect(markup).toContain('Profitability Report')
    expect(markup).toContain('Revenue (MTD)')
    expect(markup).toContain('Total Orders')
    expect(markup).toContain('Active Clients')
    expect(markup).toContain('Avg. Order Value')
    expect(markup).toContain('Order Pipeline')
    expect(markup).toContain('Top Clients')
    expect(markup).toContain('Monthly Trend')
    expect(markup).toContain('Total Revenue')
    expect(markup).toContain('Collected (Paid Invoices)')
    expect(markup).toContain('Outstanding')
    expect(markup).toContain('/en-CA/dashboard/analytics/profitability')
    expect(markup).toContain('Acme Industries')
    expect(markup).toContain('Beta Co')
    expect(mockGetOrdersAction).toHaveBeenCalledWith({ limit: 1000 })
    expect(mockGetCustomersAction).toHaveBeenCalledWith({ limit: 1000 })
    expect(mockGetInvoicesAction).toHaveBeenCalledWith({ limit: 1000 })
  })
})
