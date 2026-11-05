// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import itIT from '../../messages/it.json'
import ptPT from '../../messages/pt.json'
import { WorkAidJourney } from './workaid-journey'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const LOCALES = [
  ['en-CA', enCA],
  ['fr-CA', frCA],
  ['it', itIT],
  ['pt', ptPT],
] as const

function renderJourney(audience: 'member' | 'staff', locale = 'en-CA', messages: unknown = enCA) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages as Record<string, unknown>}>
      <WorkAidJourney audience={audience} />
    </NextIntlClientProvider>,
  )
}

const CASE = '33333333-3333-4333-8333-333333333333'
const referable = [{ matterId: '22222222-2222-4222-8222-222222222222', categories: ['case_summary'], purpose: 'wage review', expiresAt: '2027-01-01T00:00:00.000Z' }]

describe('WorkAidJourney: text in the languages the application serves', () => {
  it.each(LOCALES)('is written out in %s, not shown as message keys', async (locale, messages) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('consent-text') ? Response.json({ success: false, error: 'PRECONDITION', code: 'CONSENT_TEXT_UNAVAILABLE' }, { status: 409 }) : Response.json({ success: true, consents: [] }))))
    renderJourney('member', locale, messages)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(messages.workAidPage.memberTitle)
    expect(screen.getByTestId('workaid-boundary')).toHaveTextContent(messages.workAidPage.counselBoundary)
    expect(await screen.findByTestId('consent-text-unavailable')).toHaveTextContent(messages.workAidPage.consentTextUnavailable)
    expect(document.body).not.toHaveTextContent('workAidPage.')
  })

  it.each(LOCALES)('names the staff journey in %s', async (locale, messages) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, proposals: [] })))
    renderJourney('staff', locale, messages)

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(messages.workAidPage.staffTitle)
    expect(document.body).not.toHaveTextContent('workAidPage.')
  })
})

describe('WorkAidJourney: when the server cannot be reached or answers badly', () => {
  it('says a member\'s record could not be loaded when the request never reached the server, and stops loading', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    renderJourney('member')

    expect(await screen.findByRole('alert')).toHaveTextContent('NETWORK_ERROR')
    expect(screen.queryByText(enCA.workAidPage.loading)).not.toBeInTheDocument()
    // No consent is claimed absent when the record could not be read.
    expect(screen.queryByText(enCA.workAidPage.emptyConsents)).not.toBeInTheDocument()
  })

  it('says a consent list that is not a list is unexpected, not that the member has no consent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('consent-text')
      ? Response.json({ success: true, consentText: { version: '1', body: 'Approved wording', sha256: 'a'.repeat(64), effectiveAt: '2026-01-01T00:00:00.000Z' } })
      : Response.json({ success: true, consents: { 0: {} } }))))
    renderJourney('member')

    expect(await screen.findByRole('alert')).toHaveTextContent('UNEXPECTED_RESPONSE')
    expect(screen.queryByText(enCA.workAidPage.emptyConsents)).not.toBeInTheDocument()
  })

  it('says consent wording that is not wording is unexpected, not that nothing is wrong', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('consent-text')
      ? Response.json({ success: true })
      : Response.json({ success: true, consents: [] }))))
    renderJourney('member')

    expect(await screen.findByRole('alert')).toHaveTextContent('UNEXPECTED_RESPONSE')
  })

  it('shows the message of a refusal that carries no code', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('consent-text')
      ? Response.json({ success: true, consentText: { version: '1', body: 'Approved wording', sha256: 'a'.repeat(64), effectiveAt: '2026-01-01T00:00:00.000Z' } })
      : Response.json({ message: 'Consents are not available' }, { status: 503 }))))
    renderJourney('member')

    expect(await screen.findByRole('alert')).toHaveTextContent('Consents are not available')
  })

  it('shows the status of an answer that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('consent-text')
      ? Response.json({ success: true, consentText: { version: '1', body: 'Approved wording', sha256: 'a'.repeat(64), effectiveAt: '2026-01-01T00:00:00.000Z' } })
      : new Response('<html>Bad gateway</html>', { status: 502 }))))
    renderJourney('member')

    expect(await screen.findByRole('alert')).toHaveTextContent('502')
  })

  it('says a staff request that never reached the server failed, and does not claim no matter is ready', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET' && String(_url).includes('referrals')) throw new TypeError('Failed to fetch')
      return Response.json({ success: true, proposals: [] })
    }))
    renderJourney('staff')

    fireEvent.change(screen.getByLabelText(enCA.workAidPage.staffCaseLabel), { target: { value: CASE } })
    fireEvent.click(screen.getByRole('button', { name: enCA.workAidPage.loadReferable }))

    expect(await screen.findByRole('alert')).toHaveTextContent('NETWORK_ERROR')
    expect(screen.queryByText(enCA.workAidPage.referableEmpty)).not.toBeInTheDocument()
    expect(screen.queryByTestId('recorded-referrals')).not.toBeInTheDocument()
  })

  it.each([
    ['without the recorded referrals', { success: true, referable }],
    ['with matters that are not a list', { success: true, referable: 'wage review', recorded: [] }],
  ])('says a referral answer %s is unexpected, and shows no matter', async (_what, body) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('referrals') ? Response.json(body) : Response.json({ success: true, proposals: [] }))))
    renderJourney('staff')

    fireEvent.change(screen.getByLabelText(enCA.workAidPage.staffCaseLabel), { target: { value: CASE } })
    fireEvent.click(screen.getByRole('button', { name: enCA.workAidPage.loadReferable }))

    expect(await screen.findByRole('alert')).toHaveTextContent('UNEXPECTED_RESPONSE')
    expect(screen.queryByText('wage review')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: enCA.workAidPage.refer })).not.toBeInTheDocument()
  })

  it('says nothing about matters before a case has been looked up, and says none is ready only after a lookup that found none', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (String(url).includes('referrals') ? Response.json({ success: true, referable: [], recorded: [] }) : Response.json({ success: true, proposals: [] }))))
    renderJourney('staff')
    expect(screen.queryByText(enCA.workAidPage.referableEmpty)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(enCA.workAidPage.staffCaseLabel), { target: { value: CASE } })
    fireEvent.click(screen.getByRole('button', { name: enCA.workAidPage.loadReferable }))

    await waitFor(() => expect(screen.getByText(enCA.workAidPage.referableEmpty)).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says a wording proposal list that is not a list is unexpected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true, proposals: 'none' })))
    renderJourney('staff')

    expect(await screen.findByRole('alert')).toHaveTextContent('UNEXPECTED_RESPONSE')
  })
})
