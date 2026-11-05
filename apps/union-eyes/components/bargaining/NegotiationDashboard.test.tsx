// @vitest-environment jsdom
/**
 * The bargaining dashboard: it reads the negotiations out of what GET /api/bargaining/negotiations answers (the framework's `data` around the generic writer's own
 * { data: rows, pagination }), shows the real total, and says so when only the most recent page is loaded instead of letting the counts pass for the whole.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en-CA.json'
import { NegotiationDashboard } from './NegotiationDashboard'

const fetchMock = vi.fn()

const row = (id: string, title: string, status = 'active') => ({
  id,
  title,
  status,
  unionName: 'CUPE',
  employerName: 'City of Ottawa',
  firstSessionDate: '2026-01-05T00:00:00.000Z',
  targetCompletionDate: '2026-06-30T00:00:00.000Z',
  currentRound: 2,
  totalSessions: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const list = (rows: unknown[], total: number) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data: { data: rows, pagination: { page: 1, limit: 50, total, totalPages: 1 } }, timestamp: 'now' }),
})

function renderDashboard() {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={en}>
      <NegotiationDashboard organizationId="org-1" />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NegotiationDashboard', () => {
  it('asks for one page of the size the route allows, and shows the negotiations it answers with', async () => {
    fetchMock.mockResolvedValueOnce(list([row('n1', '2026 Renewal'), row('n2', 'Wage reopener', 'completed')], 2))
    renderDashboard()

    expect((await screen.findAllByText('2026 Renewal')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Wage reopener').length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/bargaining/negotiations?limit=50')
    expect(screen.queryByText(/most recent of/)).not.toBeInTheDocument()
  })

  it('shows the real total, and says the lists and counts cover only the most recent when there are more', async () => {
    fetchMock.mockResolvedValueOnce(list([row('n1', '2026 Renewal'), row('n2', 'Wage reopener')], 120))
    renderDashboard()

    expect(await screen.findByText('Showing the 2 most recent of 120 negotiations. The lists and counts below cover these only.')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('shows an error rather than an empty dashboard when the answer is not a list', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: {}, timestamp: 'now' }) })
    renderDashboard()

    expect(await screen.findByText('Failed to fetch negotiations')).toBeInTheDocument()
    expect(screen.queryByText('No negotiations yet')).not.toBeInTheDocument()
  })

  it('shows the empty state only when the server says there are none', async () => {
    fetchMock.mockResolvedValueOnce(list([], 0))
    renderDashboard()

    expect(await screen.findByText('No negotiations yet')).toBeInTheDocument()
  })
})
