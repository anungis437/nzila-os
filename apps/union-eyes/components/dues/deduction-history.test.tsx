// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import DeductionHistory from './deduction-history'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// What GET /api/dues/deductions sends: the route's own { data: rows } inside the framework's { success, data, timestamp } envelope. Numeric columns
// arrive as the decimal text PostgreSQL gives them.
const row = {
  id: 'deduction-1',
  payPeriodStart: '2026-03-01T00:00:00.000Z',
  payPeriodEnd: '2026-03-14T00:00:00.000Z',
  grossPay: '2400.00',
  netPay: '1910.55',
  unionDuesAmount: '45.50',
  source: 'remittance',
  verified: true,
  verifiedAt: '2026-03-20T00:00:00.000Z',
  createdAt: '2026-03-16T12:00:00.000Z',
}
const envelope = (rows: unknown[]) => ({ success: true, data: { data: rows }, timestamp: '2026-03-16T12:00:00.000Z' })

function answerWith(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => body }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderHistory(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <DeductionHistory userId="member-1" />
    </NextIntlClientProvider>,
  )
}

describe('DeductionHistory', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the deductions the route sends inside the framework envelope', async () => {
    answerWith(envelope([row]))
    renderHistory()
    expect(await screen.findByText('$45.50')).toBeInTheDocument()
    expect(screen.getByText('$2,400.00')).toBeInTheDocument()
    expect(screen.getByText(enCA.dashboard.dues.deductions.verified)).toBeInTheDocument()
    expect(screen.getByText(enCA.dashboard.dues.deductions.sources.remittance)).toBeInTheDocument()
    expect(screen.queryByText(enCA.dashboard.dues.deductions.empty)).not.toBeInTheDocument()
  })

  it('shows the empty state when the member has no deduction', async () => {
    answerWith(envelope([]))
    renderHistory()
    expect(await screen.findByText(enCA.dashboard.dues.deductions.empty)).toBeInTheDocument()
  })

  it('shows the empty state when the request fails, and never invents a row', async () => {
    answerWith({ success: false }, false)
    renderHistory()
    expect(await screen.findByText(enCA.dashboard.dues.deductions.empty)).toBeInTheDocument()
  })

  it('still reads a bare { data } body or a bare array', async () => {
    answerWith({ data: [row] })
    const first = renderHistory()
    expect(await screen.findByText('$45.50')).toBeInTheDocument()
    first.unmount()
    answerWith([row])
    renderHistory()
    expect(await screen.findByText('$45.50')).toBeInTheDocument()
  })

  it('asks for the signed-in member\'s deductions without naming anybody', async () => {
    const fetchMock = answerWith(envelope([row]))
    renderHistory()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/api/dues/deductions')
  })

  it('renders in French from the French catalogue', async () => {
    answerWith(envelope([row]))
    renderHistory('fr-CA')
    expect(await screen.findByText(frCA.dashboard.dues.deductions.sources.remittance)).toBeInTheDocument()
  })
})
