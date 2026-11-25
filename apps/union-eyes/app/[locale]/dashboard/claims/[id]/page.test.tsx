// @vitest-environment jsdom
/**
 * The case detail page shows what GET /api/claims/:id answers, which the framework wraps as { success, data: { data: <the case> } }, and the activity from
 * GET /api/cases/:id/timeline, wrapped the same way. A case that cannot be read says why, in the server's words; an answer that is not that shape is an error, never a blank page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

const h = vi.hoisted(() => ({ locale: 'en-CA', trackCaseViewed: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
  useLocale: () => h.locale,
}))
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'claim-1' }), useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/hooks/use-pilot-tracking', () => ({ usePilotTracking: () => ({ trackCaseViewed: h.trackCaseViewed }) }))
vi.mock('@/components/file-upload', () => ({ FileUpload: () => null }))
vi.mock('@/components/claims/case-deadlines', () => ({ CaseDeadlines: () => null }))

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
  h.locale = 'en-CA'
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
    expect(screen.getByText('Other')).toBeInTheDocument()
    expect(h.trackCaseViewed).toHaveBeenCalledWith('claim-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/cases/claim-1/timeline')
  })

  it('names a wage and hour case in words and never prints the stored identifier', async () => {
    routes({ claim: wrapped({ data: { ...claim, claimType: 'wage_dispute' } }), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('Wage dispute')).toBeInTheDocument()
    expect(screen.queryByText('wage_dispute')).not.toBeInTheDocument()
  })

  it('says why the case could not be loaded, in the server\'s words', async () => {
    routes({ claim: failed(500, 'The case store is unavailable'), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText(/The service is temporarily unavailable\. Try again shortly\./)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('The case store is unavailable');
    expect(screen.queryByText('CASE-2026-0042')).toBeNull()
  })

  it('words a refusal in French and never shows the server\'s English sentence or a status line', async () => {
    h.locale = 'fr-CA'
    routes({ claim: failed(500, 'The case store is unavailable'), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('Le service est momentanément indisponible. Réessayez sous peu.')).toBeInTheDocument()
    expect(screen.queryByText(/case store|HTTP/)).toBeNull()
  })

  it('shows the page\'s own message, not HTTP text, when the failure body names nothing', async () => {
    routes({ claim: { ok: false, status: 500, statusText: 'Internal Server Error', json: async () => { throw new SyntaxError('x') } }, timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('The service is temporarily unavailable. Try again shortly.')).toBeInTheDocument()
    expect(screen.queryByText(/HTTP|Internal Server Error/)).toBeNull()
  })

  it('words a gateway failure by its status instead of its status line', async () => {
    routes({ claim: { ok: false, status: 502, statusText: 'Bad Gateway', json: async () => { throw new SyntaxError('x') } }, timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByText('The service is temporarily unavailable. Try again shortly.')).toBeInTheDocument()
    expect(screen.queryByText(/HTTP|Bad Gateway/)).toBeNull()
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
    expect(await screen.findByText('claims.loadDetailFailed')).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected API response/)).toBeNull()
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
    expect(screen.getByText(new Date(2026, 2, 4, 12).toLocaleDateString('en-CA'))).toBeInTheDocument()
    expect(screen.queryByText(new Date(2026, 2, 3, 12).toLocaleDateString('en-CA'))).toBeNull()
  })

  it('labels the day the case was filed as submitted, and shows when it was last updated, in the page locale', async () => {
    process.env.TZ = 'America/Toronto'
    const dated = { ...claim, incidentDate: '2026-03-04T00:00:00.000Z', createdAt: '2026-03-10T15:00:00.000Z', updatedAt: '2026-03-12T15:00:00.000Z' }
    routes({ claim: wrapped({ data: dated }), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    await screen.findByText('CASE-2026-0042')
    expect(screen.getByText('claims.submitted')).toBeInTheDocument()
    expect(screen.queryByText('claims.submittedBy')).toBeNull()
    expect(screen.getByText(new Date(2026, 2, 10, 12).toLocaleDateString('en-CA'))).toBeInTheDocument()
    expect(screen.getByText(new Date(2026, 2, 12, 12).toLocaleDateString('en-CA'))).toBeInTheDocument()
  })

  it('says what was not recorded, instead of a label with nothing under it or "Invalid Date"', async () => {
    const sparse = { ...claim, claimNumber: null, claimType: null, location: null, description: '  ', desiredOutcome: null, createdAt: null, updatedAt: 'not a date' }
    routes({ claim: wrapped({ data: sparse }), timeline: wrapped({ data: [] }) })
    render(<ClaimDetailPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'claims.claimDetails' })).toBeInTheDocument()
    expect(screen.getAllByText('claims.notRecorded')).toHaveLength(3)
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.queryByText('Invalid Date')).toBeNull()
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
