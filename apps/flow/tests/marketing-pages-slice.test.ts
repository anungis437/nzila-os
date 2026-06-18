import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('@/components/public/site-navigation', () => ({
  SiteNavigation: () => React.createElement('nav', { 'data-testid': 'site-navigation' }, 'Nav'),
}))

vi.mock('@/components/public/site-footer', () => ({
  SiteFooter: () => React.createElement('footer', { 'data-testid': 'site-footer' }, 'Footer'),
}))

vi.mock('@/components/public/support-widget-shell', () => ({
  SupportWidgetShell: () => React.createElement('aside', { 'data-testid': 'support-widget' }, 'Support'),
}))

describe('marketing pages slices', () => {
  it('renders marketing layout shell with children', async () => {
    const { default: MarketingLayout } = await import('@/app/(marketing)/layout')
    const markup = renderToStaticMarkup(
      React.createElement(
        MarketingLayout,
        null,
        React.createElement('section', null, 'Inner content'),
      ),
    )

    expect(markup).toContain('Nav')
    expect(markup).toContain('Inner content')
    expect(markup).toContain('Footer')
    expect(markup).toContain('Support')
  })

  it('renders about, features, pricing, contact, and trial pages', async () => {
    const { default: AboutPage } = await import('@/app/(marketing)/about/page')
    const { default: FeaturesPage } = await import('@/app/(marketing)/features/page')
    const { default: PricingPage } = await import('@/app/(marketing)/pricing/page')
    const { default: ContactPage } = await import('@/app/(marketing)/contact/page')
    const { default: TrialPage } = await import('@/app/(marketing)/trial/page')

    const about = renderToStaticMarkup(React.createElement(AboutPage))
    expect(about).toContain('Operational clarity without enterprise complexity')

    const features = renderToStaticMarkup(React.createElement(FeaturesPage))
    expect(features).toContain('Template Gallery')
    expect(features).toContain('Approval workflows')

    const pricing = renderToStaticMarkup(React.createElement(PricingPage))
    expect(pricing).toContain('Pricing That Scales With Ops')
    expect(pricing).toContain('SMB ROI Calculator')

    const contact = renderToStaticMarkup(React.createElement(ContactPage))
    expect(contact).toContain('Talk to Flow sales')
    expect(contact).toContain('Book discovery call')

    const trial = renderToStaticMarkup(React.createElement(TrialPage))
    expect(trial).toContain('Step 1 of 4')
    expect(trial).toContain('Continue')
  })
})
