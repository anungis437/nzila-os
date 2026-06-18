import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { mockResolveOrgCommerceContext, mockListFlowEngineModules } = vi.hoisted(() => ({
  mockResolveOrgCommerceContext: vi.fn(async () => ({ config: { currency: 'CAD' } })),
  mockListFlowEngineModules: vi.fn(() => [
    {
      id: 'quotes',
      name: 'Quotes',
      description: 'Quote lifecycle module',
      icon: 'Q',
      bullets: ['Review gate', 'Client send'],
    },
    {
      id: 'orders',
      name: 'Orders',
      description: 'Order lifecycle module',
      icon: 'O',
      bullets: ['Payment gate', 'Shipment flow'],
    },
  ]),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('next/image', () => ({
  default: ({ alt, className }: { alt?: string; className?: string }) => React.createElement('img', { alt, className }),
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag) =>
        ({ children, ...props }: { children?: React.ReactNode }) =>
          React.createElement(String(tag), props, children),
    },
  ),
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgCommerceContext: mockResolveOrgCommerceContext,
}))

vi.mock('@/app/(dashboard)/settings/settings-form', () => ({
  SettingsForm: ({ config }: { config: { currency: string } }) =>
    React.createElement('div', { 'data-testid': 'settings-form' }, `SettingsForm:${config.currency}`),
}))

vi.mock('@nzila/flow-engine', () => ({
  listFlowEngineModules: mockListFlowEngineModules,
}))

vi.mock('@/components/public/scroll-reveal', () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

describe('dashboard and marketing shell slices', () => {
  it('renders settings and system status pages', async () => {
    const { default: SettingsPage } = await import('@/app/(dashboard)/settings/page')
    const { default: SystemStatusPage } = await import('@/app/(dashboard)/system/page')

    const settingsNode = await SettingsPage()
    const settingsMarkup = renderToStaticMarkup(settingsNode as React.ReactElement)
    expect(settingsMarkup).toContain('SettingsForm:CAD')

    const systemMarkup = renderToStaticMarkup(React.createElement(SystemStatusPage))
    expect(systemMarkup).toContain('System Status')
    expect(systemMarkup).toContain('API Server')
    expect(systemMarkup).toContain('No incidents in the last 30 days')
  })

  it('renders animated marketing components and marketing page', async () => {
    const { default: AnimatedCTA } = await import('@/app/(marketing)/components/animated-cta')
    const { default: AnimatedFeatures } = await import('@/app/(marketing)/components/animated-features')
    const { default: MarketingPage } = await import('@/app/(marketing)/page')

    const ctaMarkup = renderToStaticMarkup(React.createElement(AnimatedCTA))
    expect(ctaMarkup).toContain('Get Started Free')
    expect(ctaMarkup).toContain('Sign In')

    const featuresMarkup = renderToStaticMarkup(React.createElement(AnimatedFeatures))
    expect(featuresMarkup).toContain('The Complete Commerce Product')
    expect(featuresMarkup).toContain('Quotes')
    expect(featuresMarkup).toContain('Orders')

    const marketingMarkup = renderToStaticMarkup(React.createElement(MarketingPage))
    expect(marketingMarkup).toContain('Trade Operations')
    expect(marketingMarkup).toContain('The Complete Trade Lifecycle')
    expect(marketingMarkup).toContain('Ready to Streamline Your Trade Operations?')
  })
})
