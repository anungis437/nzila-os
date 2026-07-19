import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const {
  mockRouterPush,
  mockTriggerSalesToProcurementAction,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockTriggerSalesToProcurementAction: vi.fn(),
  mockUseSearchParams: vi.fn(() => new URLSearchParams('filter=Draft&q=acme')),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => '/quotes',
  useSearchParams: () => mockUseSearchParams(),
}))

vi.mock('@/app/actions/workflow-triggers', () => ({
  triggerSalesToProcurementAction: mockTriggerSalesToProcurementAction,
}))

describe('quotes dashboard slices', () => {
  it('renders quote detail action branches by status', async () => {
    const { QuoteDetailActions } = await import('@/app/(dashboard)/quotes/[id]/quote-detail-actions')

    const draftMarkup = renderToStaticMarkup(
      React.createElement(QuoteDetailActions, {
        quoteId: 'quote-1',
        status: 'DRAFT',
        basePath: '/workspace/ventures',
      }),
    )
    expect(draftMarkup).toContain('Submit for Review')
    expect(draftMarkup).not.toContain('Convert to PO')

    const reviewMarkup = renderToStaticMarkup(
      React.createElement(QuoteDetailActions, {
        quoteId: 'quote-1',
        status: 'INTERNAL_REVIEW',
        basePath: '/workspace/ventures',
      }),
    )
    expect(reviewMarkup).toContain('Send to Client')

    const acceptedMarkup = renderToStaticMarkup(
      React.createElement(QuoteDetailActions, {
        quoteId: 'quote-1',
        status: 'ACCEPTED',
        basePath: '/workspace/ventures',
      }),
    )
    expect(acceptedMarkup).toContain('Convert to PO')
  })

  it('renders toolbar tabs and count badges from search state', async () => {
    const { QuotesToolbar } = await import('@/app/(dashboard)/quotes/quotes-toolbar')

    const markup = renderToStaticMarkup(
      React.createElement(QuotesToolbar, {
        counts: {
          total: 22,
          drafts: 3,
          active: 7,
          won: 2,
        },
      }),
    )

    expect(markup).toContain('All')
    expect(markup).toContain('Draft')
    expect(markup).toContain('Accepted')
    expect(markup).toContain('22')
    expect(markup).toContain('3')
    expect(markup).toContain('7')
    expect(markup).toContain('2')
  })

  it('renders conversion badge loading fallback on initial render', async () => {
    const { ConversionBadge } = await import('@/app/(dashboard)/quotes/conversion-badge')

    const markup = renderToStaticMarkup(React.createElement(ConversionBadge, { quoteId: 'quote-1' }))
    expect(markup).toContain('animate-pulse')
  })
})
