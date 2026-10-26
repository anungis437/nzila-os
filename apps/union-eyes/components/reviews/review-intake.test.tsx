// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '../../messages/en-CA.json'
import fr from '../../messages/fr-CA.json'
import { ReviewIntake } from './review-intake'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const empty = { success: true, own: [], oversight: [], notificationDelivered: false, notificationPolicy: 'not_adopted' }

function renderIntake(audience: 'member' | 'oversight', locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr-CA' ? fr : en}>
      <ReviewIntake audience={audience} />
    </NextIntlClientProvider>,
  )
}

describe('ReviewIntake', () => {
  it('shows an empty member list in English and the French intake form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(empty)))
    renderIntake('member', 'en-CA')
    expect(await screen.findByTestId('own-reviews-empty')).toHaveTextContent('You have not opened a review.')
    expect(screen.queryByTestId('oversight-reviews-empty')).not.toBeInTheDocument()
    expect(screen.getByText('No notice was sent. No review-notification policy is adopted.')).toBeInTheDocument()
    cleanup()
    renderIntake('member', 'fr-CA')
    expect(await screen.findByRole('button', { name: 'Ouvrir cette revue' })).toBeInTheDocument()
    expect(screen.getByText('Plainte')).toBeInTheDocument()
    expect(screen.getByText(/n’envoie aucun avis/)).toBeInTheDocument()
  })

  it('records a confirmed intake and does not treat the response as a notice', async () => {
    const calls: Array<{ method: string; body?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined })
      if ((init?.method ?? 'GET') === 'POST') {
        return Response.json({ success: true, id: '11111111-1111-4111-8111-111111111111', notificationDelivered: false, notificationPolicy: 'not_adopted' }, { status: 201 })
      }
      const opened = calls.some((call) => call.method === 'POST')
      return Response.json(opened
        ? { ...empty, own: [{ id: '11111111-1111-4111-8111-111111111111', reviewType: 'appeal', status: 'open', openedAt: '2026-10-26T15:00:00.000Z', participation: 'opened' }] }
        : empty)
    }))
    renderIntake('member')
    expect(await screen.findByTestId('own-reviews-empty')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('What you are asking for'), { target: { value: 'appeal' } })
    fireEvent.change(screen.getByLabelText('People who should not handle this review'), { target: { value: 'user_other' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open this review' }))
    expect(await screen.findByTestId('review-opened')).toHaveTextContent('No notice was sent')
    expect(await screen.findByTestId('own-reviews')).toHaveTextContent('Appeal')
    const posted = calls.find((call) => call.method === 'POST')
    expect(JSON.parse(posted?.body ?? '{}')).toEqual({ reviewType: 'appeal', adverseUserIds: ['user_other'] })
  })

  it('shows a denial and does not show a recorded review', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') return Response.json({ success: false, code: 'NOT_AN_ACTIVE_MEMBER' }, { status: 403 })
      return Response.json(empty)
    }))
    renderIntake('member')
    expect(await screen.findByTestId('own-reviews-empty')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open this review' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not available for your membership')
    expect(screen.queryByTestId('review-opened')).not.toBeInTheDocument()
  })

  it('shows the empty oversight state and a mandated review without a respondent id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(empty)))
    renderIntake('oversight')
    expect(await screen.findByTestId('oversight-reviews-empty')).toHaveTextContent('No review is assigned')
    cleanup()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      ...empty,
      oversight: [{ id: '11111111-1111-4111-8111-111111111111', reviewType: 'complaint', status: 'open', openedAt: '2026-10-26T15:00:00.000Z', classification: 'standard', complainantUserId: 'user_member_2' }],
    })))
    renderIntake('oversight', 'fr-CA')
    expect(await screen.findByTestId('oversight-reviews')).toHaveTextContent('Plainte')
    expect(screen.getByText('Plaignant user_member_2')).toBeInTheDocument()
    expect(screen.queryByText('user_reviewer')).not.toBeInTheDocument()
  })

  it('retries after a failed load', async () => {
    let calls = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1
      if (calls === 1) return Response.json({ success: false }, { status: 500 })
      return Response.json(empty)
    }))
    renderIntake('member')
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByTestId('own-reviews-empty')).toBeInTheDocument())
  })
})