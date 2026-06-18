import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { mockPush, mockUseLocale } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseLocale: vi.fn(() => 'en-CA'),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next-intl', () => ({
  useLocale: mockUseLocale,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/app/actions/profitability', () => ({
  generateProposalsAction: vi.fn(),
}))

describe('quotes request page slice', () => {
  it('renders the request form shell and submission controls', async () => {
    const { default: QuoteRequestPage } = await import('@/app/(dashboard)/quotes/request/page')
    const markup = renderToStaticMarkup(React.createElement(QuoteRequestPage))

    expect(markup).toContain('Quote Request')
    expect(markup).toContain('Enter client requirements to generate 3 proposals with profitability analysis.')
    expect(markup).toContain('Back to Quotes')
    expect(markup).toContain('Client Information')
    expect(markup).toContain('Contact Name')
    expect(markup).toContain('Company')
    expect(markup).toContain('Project Requirements')
    expect(markup).toContain('Budget')
    expect(markup).toContain('Volume / Quantity')
    expect(markup).toContain('Category')
    expect(markup).toContain('Special Requirements')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('Generate 3 Proposals')
    expect(markup).toContain('All Categories')
    expect(markup).toContain('/en-CA/dashboard/quotes')
  })
})
