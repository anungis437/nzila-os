// @vitest-environment jsdom
import React, { type ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readBrowserDiagnostics } from '@nzila/os-core/browser-diagnostics'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en-CA.json'
import fr from '../../messages/fr-CA.json'
const telemetry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => telemetry)
import UnionEyesDashboardError from '../../app/[locale]/dashboard/error'
type Props = { error: Error & { digest?: string }; reset: () => void }
type Boundary = ComponentType<Props>
const boundaries: { name: string; load: () => Promise<Boundary> }[] = [
  { name: "apps/cfo/app/[locale]/dashboard/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/advisory-ai/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/advisory-ai/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/ai-insights/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/ai-insights/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/alerts/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/alerts/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/audit/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/audit/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/client-portal/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/client-portal/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/clients/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/clients/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/documents/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/documents/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/integrations/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/integrations/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/ledger/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/ledger/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/messages/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/messages/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/notifications/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/notifications/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/platform-admin/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/platform-admin/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/reports/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/reports/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/security/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/security/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/settings/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/settings/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/tasks/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/tasks/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/tax-tools/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/tax-tools/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/workflows/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/workflows/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/documents/upload/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/documents/upload/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/workflows/[id]/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/workflows/[id]/error")).default },
  { name: "apps/cfo/app/[locale]/dashboard/workflows/new/error.tsx", load: async () => (await import("../../../cfo/app/[locale]/dashboard/workflows/new/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/artists/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/artists/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/browse/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/browse/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/events/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/events/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/notifications/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/notifications/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/playlists/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/playlists/error")).default },
  { name: "apps/zonga/app/[locale]/dashboard/tracks/error.tsx", load: async () => (await import("../../../zonga/app/[locale]/dashboard/tracks/error")).default },
  { name: "apps/partners/app/[locale]/admin/error.tsx", load: async () => (await import("../../../partners/app/[locale]/admin/error")).default },
  { name: "apps/partners/app/admin/error.tsx", load: async () => (await import("../../../partners/app/admin/error")).default },
  { name: "apps/partners/app/[locale]/portal/error.tsx", load: async () => (await import("../../../partners/app/[locale]/portal/error")).default },
  { name: "apps/partners/app/portal/error.tsx", load: async () => (await import("../../../partners/app/portal/error")).default },
  { name: "apps/nacp-exams/app/[locale]/dashboard/error.tsx", load: async () => (await import("../../../nacp-exams/app/[locale]/dashboard/error")).default },
  { name: "apps/console/components/ui/ErrorPanel.tsx", load: async () => { const { ErrorPanel } = await import("../../../console/components/ui/ErrorPanel"); return props => <ErrorPanel {...props} scope="private-scope-canary" /> } },
  { name: "apps/nzila-hq/components/primitives/ErrorPanel.tsx", load: async () => { const { ErrorPanel } = await import("../../../nzila-hq/components/primitives/ErrorPanel"); return props => <ErrorPanel {...props} scope="private-scope-canary" /> } },
]
afterEach(() => { cleanup(); vi.restoreAllMocks(); telemetry.captureException.mockReset() })

describe('real browser error boundary reporting and recovery', () => {
  for (const [locale, messages, title, retry, home, help] of [
    ['en-CA', en, 'Something went wrong', 'Try again', 'Go to homepage', 'get help'],
    ['fr-CA', fr, "Une erreur s'est produite", 'Réessayer', "Aller à la page d'accueil", "consulter l'aide"],
  ] as const) {
    it(`Union Eyes ${locale} preserves translated retry/home/help and existing SDK capture without claiming delivery`, async () => {
      const error = Object.assign(new Error('private-error-message-canary'), { digest: 'opaque-ue-error' })
      const reset = vi.fn()
      render(<NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC"><UnionEyesDashboardError error={error} reset={reset} /></NextIntlClientProvider>)
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
      expect(screen.getByRole('link', { name: home }).getAttribute('href')).toBe(`/${locale}`)
      expect(screen.getByRole('link', { name: help }).getAttribute('href')).toBe(`/${locale}/dashboard/help`)
      expect(screen.queryByText(/team has been notified|has been logged|équipe.*avisée/i)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: retry }))
      expect(reset).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(telemetry.captureException).toHaveBeenCalledWith(error, { tags: { boundary: 'dashboard', reference: error.digest } }))
      expect(readBrowserDiagnostics().at(-1)).toMatchObject({ app: 'union-eyes', reference: error.digest })
      expect(JSON.stringify(readBrowserDiagnostics())).not.toContain('private-error-message-canary')
    })
  }

  it('Union Eyes recovery still works when the SDK throws and no server digest exists', async () => {
    telemetry.captureException.mockImplementation(() => { throw new Error('private-sdk-failure') })
    const reset = vi.fn()
    render(<NextIntlClientProvider locale="en-CA" messages={en} timeZone="UTC"><UnionEyesDashboardError error={new Error('private-error-message-canary')} reset={reset} /></NextIntlClientProvider>)
    expect(screen.getByText(/Local reference:/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reset).toHaveBeenCalledTimes(1)
    expect(readBrowserDiagnostics().at(-1)).toMatchObject({ app: 'union-eyes', referenceOrigin: 'local' })
    expect(screen.queryByText(/team has been notified/i)).toBeNull()
  })

  boundaries.forEach(({ name, load }, index) => {
    it(`${name} records only local metadata and preserves retry`, async () => {
      const Component = await load()
      const error = Object.assign(new Error('private-error-message-canary'), { digest: `opaque-${index}` })
      const reset = vi.fn()
      render(<Component error={error} reset={reset} />)
      await waitFor(() => expect(readBrowserDiagnostics().at(-1)?.reference).toBe(error.digest))
      const packet = JSON.stringify(readBrowserDiagnostics())
      expect(packet).not.toContain('private-error-message-canary')
      expect(packet).not.toContain('private-scope-canary')
      expect(screen.queryByText(/has been logged|logged automatically|team has been notified/i)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }))
      expect(reset).toHaveBeenCalledTimes(1)
    })
  })

  for (const app of ['console', 'nzila-hq']) {
    it(`${app} keeps a stable local reference through rerender and copies that exact reference`, async () => {
      const fixture = boundaries.find(entry => entry.name.startsWith(`apps/${app}/`))!
      const Component = await fixture.load()
      const error = new Error('private-error-message-canary')
      const reset = vi.fn()
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      const view = render(<Component error={error} reset={reset} />)
      await waitFor(() => expect(readBrowserDiagnostics().at(-1)?.app).toBe(app))
      const reference = readBrowserDiagnostics().at(-1)!.reference
      expect(reference).toMatch(/^local-/)
      expect(screen.getByText(/Local reference:/)).toBeTruthy()
      view.rerender(<Component error={error} reset={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: /copy incident/i }))
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(reference))
      expect(readBrowserDiagnostics().at(-1)?.reference).toBe(reference)
    })
  }
})
