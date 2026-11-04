// @vitest-environment jsdom
/**
 * The case detail page shows what GET /api/claims/:id answers, which the framework wraps as { success, data: { data: <the case> } }, and the activity from
 * GET /api/cases/:id/timeline, wrapped the same way. A case that cannot be read says why, in the server's words; an answer that is not that shape is an error, never a blank page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({ trackCaseViewed: vi.fn() }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en-CA' }))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'claim-1' }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/hooks/use-pilot-tracking', () => ({ usePilotTracking: () => ({ trackCaseViewed: h.trackCaseViewed }) }))
vi.mock('@/components/file-upload', () => ({ FileUpload: () => null }))
vi.mock('@/components/claims/claim-deadline-unavailable', () => ({ ClaimDeadlineUnavailable: () => null }))

import ClaimDetailPage from './page'

const fetchMock = vi.fn()

const claim = {
  claimId: 'claim-1',
  claimNumber: 'CASE-2026-0042',
  claimType: 'other',
  status: 'submitted',
  priority: 'medium',
  description: 'The schedule was changed without notice',
  desiredOutcome: 'The previous schedule is restored',
  witnessesPresent: false,
  witnessDetails: null,
  attachments: [],
}

const wrapped = (data: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data, timestamp: 'now' }) })
const failed = (status: number, message: string) => ({ ok: false, status, statusText: 'Failed', json: async () => ({ code: 'FAILED', message, timestamp: 'now', traceId: 't' }) })

const routes = (answers: { claim: unknown; timeline: unknown }) =>
  fetchMock.mockImplementation(async (url: string) => (url === '/api/claims/claim-1' ? answers.claim : answers.timeline))

const zone = process.env.TZ

beforeEach(() => {
  fetchMock.mockReset()
  h.trackCaseViewed.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (zone === undefined) delete process.env.TZ
  else process.env.TZ = zone
})

describe('ClaimDetailPage', () => {
  it('shows the case and its activity, each found under data.data', async () => {
    routes({ claim: wrapped({ data: claim }), timeline: wrapped({ data: [{ id: 'a1', timestamp: '2026-03-01T00:00:00Z', description: 'Assigned to a steward' }] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('CASE-2026-0042')).toBeInTheDocument()
    expect(screen.getByText('The schedule was changed without notice')).toBeInTheDocument()
    expect(await screen.findByText('Assigned to a steward')).toBeInTheDocument()
    expect(h.trackCaseViewed).toHaveBeenCalledWith('claim-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/cases/claim-1/timeline')
  })

  it('says why the case could not be loaded, in the server\'s words', async () => {
    routes({ claim: failed(500, 'The case store is unavailable'), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('The case store is unavailable')).toBeInTheDocument()
    expect(screen.queryByText('CASE-2026-0042')).toBeNull()
  })

  it('does not tell a missing case from one the user may not read', async () => {
    routes({ claim: failed(404, 'Case not found'), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('claimsPage.notAvailableTitle')).toBeInTheDocument()
    expect(screen.queryByText('Case not found')).toBeNull()
  })

  it('treats an answer that is not the case as an error, instead of rendering a blank case', async () => {
    routes({ claim: wrapped(claim), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText(/Unexpected API response/)).toBeInTheDocument()
    expect(screen.queryByText('CASE-2026-0042')).toBeNull()
  })

  it('shows the case with a notice, not an empty history, when only the activity could not be read', async () => {
    routes({ claim: wrapped({ data: claim }), timeline: failed(500, 'Timeline unavailable') })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('CASE-2026-0042')).toBeInTheDocument()
    expect(await screen.findByTestId('case-activity-error')).toBeInTheDocument()
  })

  it('shows the incident day that was recorded, not the evening before it, for a reader west of Greenwich', async () => {
    process.env.TZ = 'America/Toronto'
    // A day entered on a date input and stored as UTC midnight: 4 March, which is the evening of 3 March in Toronto when read as an instant.
    const dated = { ...claim, incidentDate: '2026-03-04T00:00:00.000Z', createdAt: '2026-03-10T15:00:00.000Z', updatedAt: '2026-03-10T15:00:00.000Z' }
    routes({ claim: wrapped({ data: dated }), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    await screen.findByText('CASE-2026-0042')
    expect(screen.getByText(new Date(2026, 2, 4, 12).toLocaleDateString())).toBeInTheDocument()
    expect(screen.queryByText(new Date(2026, 2, 3, 12).toLocaleDateString())).toBeNull()
  })

  it('says no incident date was recorded when the case has none, instead of printing "Invalid Date"', async () => {
    const undated = { ...claim, incidentDate: null, createdAt: '2026-03-10T15:00:00.000Z', updatedAt: '2026-03-10T15:00:00.000Z' }
    routes({ claim: wrapped({ data: undated }), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    await screen.findByText('CASE-2026-0042')
    expect(screen.getByText('claims.incidentDateNotRecorded')).toBeInTheDocument()
    expect(screen.queryByText('Invalid Date')).toBeNull()
  })
})
