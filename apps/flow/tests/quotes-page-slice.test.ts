import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockGetLocale,
  mockFindAll,
  mockFindById,
  mockGetReadContext,
} = vi.hoisted(() => ({
  mockGetLocale: vi.fn(() => 'en-CA'),
  mockFindAll: vi.fn(),
  mockFindById: vi.fn(),
  mockGetReadContext: vi.fn(() => ({ orgId: 'org-1' })),
}))

vi.mock('next-intl/server', () => ({
  getLocale: mockGetLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/lib/org-resolver', () => ({
  getReadContext: mockGetReadContext,
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: { findAll: mockFindAll },
  customerRepo: { findById: mockFindById },
}))

vi.mock('@/app/(dashboard)/quotes/quotes-toolbar', () => ({
  QuotesToolbar: ({ counts }: { counts: { total: number; drafts: number; active: number; won: number } }) =>
    React.createElement('div', { 'data-testid': 'toolbar' }, `${counts.total}-${counts.drafts}-${counts.active}-${counts.won}`),
}))

vi.mock('@/app/(dashboard)/quotes/conversion-badge', () => ({
  ConversionBadge: ({ quoteId }: { quoteId: string }) =>
    React.createElement('span', { 'data-testid': 'conversion-badge' }, quoteId),
}))

describe('quotes page slice', () => {
  beforeEach(() => {
    mockFindAll.mockReset()
    mockFindById.mockReset()
    mockGetReadContext.mockClear()
  })

  it('renders the empty state when no quotes exist', async () => {
    mockFindAll.mockResolvedValue([])

    const { default: QuotesListPage } = await import('@/app/(dashboard)/quotes/page')
    const markup = renderToStaticMarkup(await QuotesListPage({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain('Quotes')
    expect(markup).toContain('Manage proposals, track lifecycle, and convert to orders.')
    expect(markup).toContain('Quote Request')
    expect(markup).toContain('New Quote')
    expect(markup).toContain('No quotes yet')
    expect(markup).toContain('Create First Quote')
    expect(markup).toContain('/en-CA/dashboard/quotes/new')
    expect(markup).toContain('0-0-0-0')
  })

  it('renders a populated table row with resolved customer names', async () => {
    mockFindAll.mockResolvedValue([
      {
        id: 'quote-1',
        reference: 'Q-001',
        title: 'Holiday Proposal',
        status: 'ACCEPTED',
        tier: 'PREMIUM',
        total: 1250,
        createdAt: new Date('2026-06-01T12:00:00.000Z'),
        customerId: 'customer-1',
      },
    ])
    mockFindById.mockResolvedValue({ id: 'customer-1', name: 'Acme Inc' })

    const { default: QuotesListPage } = await import('@/app/(dashboard)/quotes/page')
    const markup = renderToStaticMarkup(
      await QuotesListPage({ searchParams: Promise.resolve({ filter: 'Accepted', q: 'acme' }) }),
    )

    expect(markup).toContain('Quotes')
    expect(markup).toContain('Q-001')
    expect(markup).toContain('Holiday Proposal')
    expect(markup).toContain('Acme Inc')
    expect(markup).toContain('Premium')
    expect(markup).toContain('Accepted')
    expect(markup).toContain('$1,250.00')
    expect(markup).toContain('toolbar')
    expect(markup).toContain('conversion-badge')
    expect(markup).toContain('/en-CA/dashboard/quotes/quote-1')
  })
})
