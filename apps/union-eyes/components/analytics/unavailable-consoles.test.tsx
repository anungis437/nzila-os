// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'

import { AnalyticsOverviewConsole } from './analytics-overview-console'
import CrossUnionAnalyticsConsole from '../cross-union-analytics/cross-union-analytics-console'
import CLCIntelligenceConsole from '../clc/clc-intelligence-console'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const consoles = [
  ['analytics overview', () => <AnalyticsOverviewConsole canViewTopPerformers />, 'UE-ANALYTICS-OVERVIEW', enCA.analytics.title],
  ['cross-union analytics', () => <CrossUnionAnalyticsConsole />, 'UE-CROSS-UNION-ANALYTICS', 'Cross-Union Analytics'],
  ['CLC labour intelligence', () => <CLCIntelligenceConsole />, 'UE-CLC-INTELLIGENCE', 'Labour Intelligence'],
] as const

describe.each(consoles)('%s console', (_name, element, capability, heading) => {
  it('says the service behind it is not available, and requests nothing from a route that answers 410', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<NextIntlClientProvider locale="en-CA" messages={enCA}>{element()}</NextIntlClientProvider>)
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Not available in this release')
    expect(screen.getByText(capability)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows no figure, chart control or export a reader could take for data', () => {
    render(<NextIntlClientProvider locale="en-CA" messages={enCA}>{element()}</NextIntlClientProvider>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\d+(\.\d+)?%?$/)).not.toBeInTheDocument()
  })
})
