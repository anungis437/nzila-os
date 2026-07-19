import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { mockNotFound, mockUsePathname, mockGetMessages } = vi.hoisted(() => ({
  mockNotFound: vi.fn(),
  mockUsePathname: vi.fn(() => '/en-CA/dashboard/orders'),
  mockGetMessages: vi.fn(async () => ({ hello: 'world' })),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
  usePathname: () => mockUsePathname(),
}))

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'intl-provider' }, children),
}))

vi.mock('next-intl/server', () => ({
  getMessages: mockGetMessages,
}))

vi.mock('@/lib/locales', () => ({
  locales: ['en-CA', 'fr-CA'],
}))

vi.mock('@/app/(dashboard)/components/org-picker', () => ({
  OrgPicker: () => React.createElement('div', { 'data-testid': 'org-picker' }, 'OrgPicker'),
}))

describe('locale layout slices', () => {
  it('renders locale layout and triggers notFound on unsupported locale', async () => {
    const { default: LocaleLayout } = await import('@/app/[locale]/layout')

    const okNode = await LocaleLayout({
      children: React.createElement('section', null, 'Locale child'),
      params: Promise.resolve({ locale: 'en-CA' }),
    })
    const okMarkup = renderToStaticMarkup(okNode as React.ReactElement)
    expect(okMarkup).toContain('Locale child')
    expect(mockGetMessages).toHaveBeenCalled()

    await LocaleLayout({
      children: React.createElement('section', null, 'Bad locale'),
      params: Promise.resolve({ locale: 'es-ES' }),
    })
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders locale dashboard layout navigation and header', async () => {
    const { default: DashboardLayout } = await import('@/app/[locale]/dashboard/layout')

    const markup = renderToStaticMarkup(
      React.createElement(
        DashboardLayout,
        null,
        React.createElement('div', null, 'Dashboard content'),
      ),
    )

    expect(markup).toContain('Flow')
    expect(markup).toContain('Sales &amp; Commerce')
    expect(markup).toContain('System Status')
    expect(markup).toContain('Dashboard content')
    expect(markup).toContain('English')
    expect(markup).toContain('OrgPicker')
  })
})
