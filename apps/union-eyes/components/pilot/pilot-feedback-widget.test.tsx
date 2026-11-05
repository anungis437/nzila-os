// @vitest-environment jsdom
/**
 * The pilot feedback widget: shown to pilot users after their first case and at the usage milestone, it sends what POST /api/pilot/feedback takes and nothing else
 * (the server reads who and which organization from the session), in the language of the page, and a prompt that was dismissed does not come back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en-CA.json'
import fr from '@/messages/fr-CA.json'

const h = vi.hoisted(() => ({ pilot: true }))

vi.mock('@/contexts/pilot-mode-context', () => ({ usePilotMode: () => ({ isPilotMode: h.pilot }) }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={className}>{children}</div> },
}))

import PilotFeedbackWidget, { incrementPilotCaseCount } from './pilot-feedback-widget'

const fetchMock = vi.fn()

function renderWidget(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? en : fr}>
      <PilotFeedbackWidget />
    </NextIntlClientProvider>,
  )
}

const sentBody = () => JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>

beforeEach(() => {
  h.pilot = true
  localStorage.clear()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('PilotFeedbackWidget: when it shows', () => {
  it('stays away outside pilot mode, and before there is anything to ask about', () => {
    h.pilot = false
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget()
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()
    cleanup()
    h.pilot = true
    localStorage.setItem('ue-pilot-case-count', '2')
    renderWidget()
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()
  })

  it('shows after the first case and at the usage milestone', () => {
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget()
    expect(screen.getByText('Quick feedback')).toBeInTheDocument()
    cleanup()
    localStorage.setItem('ue-pilot-case-count', '4')
    renderWidget()
    expect(screen.getByText('Quick feedback')).toBeInTheDocument()
  })

  it('shows the moment a case is created in this tab, without a reload', async () => {
    renderWidget()
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()
    act(() => incrementPilotCaseCount())
    expect(await screen.findByText('Quick feedback')).toBeInTheDocument()
  })

  it('is in the language of the page', () => {
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget('fr-CA')
    expect(screen.getByText('Rétroaction rapide')).toBeInTheDocument()
    expect(screen.getByText('Était-ce facile à utiliser?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Évaluer 3 sur 5' })).toBeInTheDocument()
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()
  })
})

describe('PilotFeedbackWidget: what it sends', () => {
  it('sends the rating, the reason, the comment and the trigger, and never who is giving it', async () => {
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Rate 2 out of 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Too slow' }))
    fireEvent.change(screen.getByPlaceholderText('Any details? (optional)'), { target: { value: '  Took a while to save  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pilot/feedback')
    expect((fetchMock.mock.calls[0][1] as { method: string }).method).toBe('POST')
    expect(sentBody()).toEqual({ easeRating: 2, category: 'slow', comment: 'Took a while to save', trigger: 'first_case' })
    expect(await screen.findByText('Thank you!')).toBeInTheDocument()
    expect(localStorage.getItem('ue-pilot-feedback-given')).toBe('true')
  })

  it('names the milestone as the trigger, and sends no reason that a better rating made stale', async () => {
    localStorage.setItem('ue-pilot-case-count', '3')
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Rate 1 out of 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confusing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Rate 5 out of 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sentBody()).toEqual({ easeRating: 5, category: null, comment: null, trigger: 'milestone_usage' })
  })

  it('does not send without a rating', () => {
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says so when the feedback could not be sent, and does not count it as given', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Rate 4 out of 5' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your feedback could not be sent. Try again.')
    expect(localStorage.getItem('ue-pilot-feedback-given')).toBeNull()
    expect(screen.queryByText('Thank you!')).not.toBeInTheDocument()
  })
})

describe('PilotFeedbackWidget: dismissing', () => {
  it('does not come back for the trigger that was dismissed, and comes back for the next one', () => {
    localStorage.setItem('ue-pilot-case-count', '1')
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()
    expect(localStorage.getItem('ue-pilot-feedback-dismissed')).toBe('first_case')
    expect(fetchMock).not.toHaveBeenCalled()

    cleanup()
    renderWidget()
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()

    cleanup()
    localStorage.setItem('ue-pilot-case-count', '3')
    renderWidget()
    expect(screen.getByText('Quick feedback')).toBeInTheDocument()
  })

  it('stays away once feedback was given', () => {
    localStorage.setItem('ue-pilot-case-count', '1')
    localStorage.setItem('ue-pilot-feedback-given', 'true')
    renderWidget()
    expect(screen.queryByText('Quick feedback')).not.toBeInTheDocument()
  })
})
