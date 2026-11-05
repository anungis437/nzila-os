// @vitest-environment jsdom
/**
 * The case studies page shows what GET /api/case-studies answers, which the framework wraps as { success, data: { data: rows, pagination } }. A request that failed, or an answer that
 * is not that shape, is said to have failed; it is never shown as "no case studies match your filters".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'en-CA' }), notFound: () => { throw new Error('notFound') } }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@/lib/marketing-feature-flags', () => ({ CASE_STUDIES_VISIBLE: true }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/components/marketing/MarketingHeroSection', () => ({ MarketingHeroSection: () => null }))
vi.mock('@/components/marketing/human-centered-callout', () => ({ HumanCenteredCallout: () => null }))
vi.mock('@/components/marketing/case-study-card', () => ({
  CaseStudyGrid: ({ caseStudies }: { caseStudies: Array<{ id: string; title: string }> }) => (
    <ul>
      {caseStudies.map((study) => (
        <li key={study.id}>{study.title}</li>
      ))}
    </ul>
  ),
}))

import CaseStudiesPage from './page'

const fetchMock = vi.fn()

const study = (id: string, title: string, category: string) => ({ id, title, category, organizationType: 'local' })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CaseStudiesPage', () => {
  it('shows the rows the route answers, found under data.data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { data: [study('1', 'First study', 'governance'), study('2', 'Second study', 'continuity')], pagination: { page: 1, limit: 50, total: 2, totalPages: 1 } }, timestamp: 'now' }),
    })
    render(<CaseStudiesPage />)
    expect(await screen.findByText('First study')).toBeInTheDocument()
    expect(screen.getByText('Second study')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/case-studies?status=published')
  })

  it('says the case studies could not be loaded when the request failed', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ code: 'INTERNAL', message: 'boom', timestamp: 'now', traceId: 't' }) })
    render(<CaseStudiesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Case studies could not be loaded')
    expect(screen.queryByText(/No case studies match/)).toBeNull()
  })

  it('says it too when the answer is not a list of rows, instead of showing an empty page', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: { caseStudies: [study('1', 'Legacy', 'governance')] }, timestamp: 'now' }) })
    render(<CaseStudiesPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Case studies could not be loaded'))
    expect(screen.queryByText('Legacy')).toBeNull()
  })

  it('offers only filters its rows can fill: a category and an organisation type, not a sector or a jurisdiction no column holds', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { data: [{ ...study('1', 'A', 'governance'), organizationType: 'local' }, { ...study('2', 'B', 'continuity'), organizationType: 'national' }], pagination: {} }, timestamp: 'now' }),
    })
    render(<CaseStudiesPage />)
    await screen.findByText('A')
    expect(screen.getByText('Category:')).toBeInTheDocument()
    expect(screen.getByText('Org type:')).toBeInTheDocument()
    expect(screen.queryByText('Sector:')).toBeNull()
    expect(screen.queryByText('Jurisdiction:')).toBeNull()
  })
})
