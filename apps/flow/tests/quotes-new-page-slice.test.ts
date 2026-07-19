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

vi.mock('@/lib/actions', () => ({
  createQuoteAction: vi.fn(),
}))

describe('quotes new page slice', () => {
  it('renders the new quote shell with the default assistant and summary state', async () => {
    const { default: NewQuotePage } = await import('@/app/(dashboard)/quotes/new/page')
    const markup = renderToStaticMarkup(React.createElement(NewQuotePage))

    expect(markup).toContain('New Quote')
    expect(markup).toContain('Create a tiered gift box proposal with automatic Quebec tax calculation.')
    expect(markup).toContain('Back to Quotes')
    expect(markup).toContain('Client')
    expect(markup).toContain('Quote Details')
    expect(markup).toContain('Line Items')
    expect(markup).toContain('Summary')
    expect(markup).toContain('Create Quote')
    expect(markup).toContain('Cancel')
    expect(markup).toContain('AI Assistant')
    expect(markup).toContain('Company / Name')
    expect(markup).toContain('Pricing Tier')
    expect(markup).toContain('Budget')
    expect(markup).toContain('Standard')
    expect(markup).toContain('Premium')
    expect(markup).toContain('Fill in all sections to complete your quote.')
    expect(markup).toContain('Zoho')
    expect(markup).toContain('Theme')
    expect(markup).toContain('Holiday')
    expect(markup).toContain('Subtotal')
    expect(markup).toContain('GST (5%)')
    expect(markup).toContain('QST (9.975%)')
    expect(markup).toContain('Total')
    expect(markup).toContain('/en-CA/dashboard/quotes')
  })
})
