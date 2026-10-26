// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en.json'
import fr from '../../messages/fr.json'
import { WORKAID_CATEGORIES } from '@/lib/authority/workaid-disclosure'
import { WORKAID_UI_CATEGORIES, WorkAidJourney } from './workaid-journey'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const consent = {
  consentId: '11111111-1111-4111-8111-111111111111',
  matterId: '22222222-2222-4222-8222-222222222222',
  caseId: '33333333-3333-4333-8333-333333333333',
  categories: ['documents'],
  purpose: 'wage review',
  expiresAt: '2027-01-01T00:00:00.000Z',
  state: 'live',
  referred: false,
  referralWithdrawn: false,
  counselAccepted: false,
  documentAuthorisations: [
    { id: '44444444-4444-4444-8444-444444444444', documentId: '55555555-5555-4555-8555-555555555555', classification: 'member_submission', expiresAt: '2027-01-01T00:00:00.000Z', revoked: false },
  ],
}

function renderJourney(audience: 'member' | 'staff', locale: 'en' | 'fr' = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
      <WorkAidJourney audience={audience} />
    </NextIntlClientProvider>,
  )
}

describe('WorkAidJourney', () => {
  it('uses the closed disclosure vocabulary', () => {
    expect([...WORKAID_UI_CATEGORIES]).toEqual([...WORKAID_CATEGORIES])
  })

  it('shows the union-side boundary in English and French and does not offer consent without recorded wording', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('consent-text')) return Response.json({ success: false, error: 'PRECONDITION', code: 'CONSENT_TEXT_UNAVAILABLE' }, { status: 409 })
      return Response.json({ success: true, consents: [] })
    }))
    renderJourney('member', 'en')
    expect(await screen.findByTestId('consent-text-unavailable')).toHaveTextContent('approved wording')
    expect(screen.getByTestId('workaid-boundary')).toHaveTextContent('nothing here is transmitted')
    expect(screen.queryByRole('button', { name: 'Record consent' })).not.toBeInTheDocument()
    cleanup()
    renderJourney('member', 'fr')
    expect(await screen.findByTestId('workaid-boundary')).toHaveTextContent("Aucun système de conseil n'est connecté")
  })

  it('revokes a live consent and a visible document without treating the response as counsel delivery', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (String(url).includes('consent-text')) return Response.json({ success: false, code: 'CONSENT_TEXT_UNAVAILABLE' }, { status: 409 })
      if (String(url).includes('/revoke')) return Response.json({ success: true })
      return Response.json({ success: true, consents: calls.some((call) => call.includes('/revoke')) ? [] : [consent] })
    }))
    renderJourney('member')
    expect(await screen.findByText(/Visible under this consent/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw this document' }))
    await waitFor(() => expect(calls.some((call) => call.startsWith('POST') && call.includes('/documents/'))).toBe(true))
    expect(screen.queryByText('Recorded on the union side only')).not.toBeInTheDocument()
  })

  it('refuses a staff referral that the server denies and does not show a recorded referral', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') {
        return Response.json({ success: true, referable: [{ matterId: '22222222-2222-4222-8222-222222222222', categories: ['case_summary'], purpose: 'wage review', expiresAt: '2027-01-01T00:00:00.000Z' }] })
      }
      return Response.json({ success: false, error: 'DENIED', code: 'RECUSAL_REQUIRED' }, { status: 403 })
    }))
    renderJourney('staff')
    fireEvent.change(screen.getByLabelText('Case to review'), { target: { value: '33333333-3333-4333-8333-333333333333' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show matters you may refer' }))
    expect(await screen.findByText('wage review')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Record referral' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('RECUSAL_REQUIRED')
    expect(screen.queryByText('Recorded on the union side only. Nothing was sent to counsel.')).not.toBeInTheDocument()
  })

  it('records a referral only when the server says nothing was delivered to counsel', async () => {
    const row = { matterId: '22222222-2222-4222-8222-222222222222', categories: ['case_summary'], purpose: 'wage review', expiresAt: '2027-01-01T00:00:00.000Z' }
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return Response.json({ success: true, referable: [row] })
      return Response.json({ success: true, delivered: false, counselAcknowledged: false }, { status: 201 })
    }))
    renderJourney('staff')
    fireEvent.change(screen.getByLabelText('Case to review'), { target: { value: '33333333-3333-4333-8333-333333333333' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show matters you may refer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Record referral' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Nothing was sent to counsel')
  })
})
