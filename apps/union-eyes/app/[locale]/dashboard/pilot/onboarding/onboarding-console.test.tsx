// @vitest-environment jsdom
/**
 * The pilot onboarding console: it reads the steps and the demo state out of what GET /api/pilot/onboarding answers under `data`, asks the server to verify a step by the
 * id the API knows (not the id the checklist shows), says in the server's words why a step was refused or a request failed, and shows the one support address the
 * product has — nothing invented.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import OnboardingConsole from './onboarding-console'

const fetchMock = vi.fn()

const answer = (items: Record<string, boolean>, demo: unknown = { isActive: false }) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data: { items, completedCount: Object.values(items).filter(Boolean).length, totalCount: 7, isComplete: false, demo }, timestamp: 'now' }),
})

const refusal = (status: number, message: string) => ({ ok: false, status, json: async () => ({ code: 'CONFLICT', message, timestamp: 'now', traceId: 't' }) })

const requestsTo = (method: string) => fetchMock.mock.calls.filter(([, init]) => ((init as { method?: string } | undefined)?.method ?? 'GET') === method)

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('OnboardingConsole: what it shows', () => {
  it('reads the steps out of the framework data and shows the support address it was given, and nothing made up', async () => {
    fetchMock.mockResolvedValueOnce(answer({ 'org-seeded': true }))
    render(<OnboardingConsole supportEmail="help@example.test" />)

    expect(await screen.findByText('1 of 7 steps completed')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /help@example\.test|Contact Support/ }).map((link) => link.getAttribute('href'))).toEqual([
      'mailto:help@example.test',
      'mailto:help@example.test?subject=Pilot%20Support%20Request',
    ])
    expect(document.body.textContent).not.toMatch(/nzila\.io|assigned pilot lead|go-live review|escalation/i)
    expect(fetchMock).toHaveBeenCalledWith('/api/pilot/onboarding')
  })

  it('does not put up a checklist of nothing done when the status could not be read, and says why', async () => {
    fetchMock.mockResolvedValueOnce(refusal(500, 'Failed to load onboarding checklist'))
    render(<OnboardingConsole supportEmail="help@example.test" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load onboarding checklist')
    expect(screen.queryByText('Pilot Readiness')).not.toBeInTheDocument()
    expect(screen.getByText('help@example.test')).toBeInTheDocument()
  })
})

describe('OnboardingConsole: verifying a step', () => {
  it('asks the server to verify the step by the id the API knows, then reads the state again', async () => {
    fetchMock.mockResolvedValueOnce(answer({}))
    render(<OnboardingConsole supportEmail="help@example.test" />)
    await screen.findByText('0 of 7 steps completed')

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) })
    fetchMock.mockResolvedValueOnce(answer({ 'org-seeded': true }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Verify' })[0])

    expect(await screen.findByText('1 of 7 steps completed')).toBeInTheDocument()
    const [patch] = requestsTo('PATCH')
    expect(patch[0]).toBe('/api/pilot/onboarding')
    expect(JSON.parse((patch[1] as { body: string }).body)).toEqual({ itemId: 'org-seeded', completed: true })
  })

  it('does not treat going to where a step is done as having done it', async () => {
    fetchMock.mockResolvedValueOnce(answer({}))
    render(<OnboardingConsole supportEmail="help@example.test" />)
    await screen.findByText('0 of 7 steps completed')

    // jsdom cannot navigate: a link's default action is cancelled, and what matters is that following it asks the server for nothing.
    document.addEventListener('click', (event) => event.preventDefault(), { once: true })
    fireEvent.click(screen.getByRole('link', { name: /View org settings/ }))

    expect(requestsTo('PATCH')).toHaveLength(0)
  })

  it("says, in the server's words, why a step was not marked done, and does not pretend it was", async () => {
    fetchMock.mockResolvedValueOnce(answer({}))
    render(<OnboardingConsole supportEmail="help@example.test" />)
    await screen.findByText('0 of 7 steps completed')

    fetchMock.mockResolvedValueOnce(refusal(409, 'This step cannot be marked complete: the system found no employer record.'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Verify' })[4])

    expect(await screen.findByRole('alert')).toHaveTextContent('the system found no employer record')
    expect(JSON.parse((requestsTo('PATCH')[0][1] as { body: string }).body).itemId).toBe('employers-imported')
    expect(screen.getByText('0 of 7 steps completed')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('OnboardingConsole: demo data', () => {
  it('loads demo data and reads the state again', async () => {
    fetchMock.mockResolvedValueOnce(answer({}))
    render(<OnboardingConsole supportEmail="help@example.test" />)
    await screen.findByText('0 of 7 steps completed')

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) })
    fetchMock.mockResolvedValueOnce(answer({}, { isActive: true, telemetryTag: 'demo_mode_active', dataset: { members: 10, employers: 2, grievances: 3, timelines: 1, resolutions: 1 } }))
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }))

    expect(await screen.findByRole('button', { name: 'Remove Demo Data' })).toBeInTheDocument()
    expect(requestsTo('POST')[0][0]).toBe('/api/pilot/demo-data')
  })

  it('says why demo data could not be loaded instead of leaving the button to do nothing', async () => {
    fetchMock.mockResolvedValueOnce(answer({}))
    render(<OnboardingConsole supportEmail="help@example.test" />)
    await screen.findByText('0 of 7 steps completed')

    fetchMock.mockResolvedValueOnce(refusal(409, 'Demo data already exists for this organization.'))
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Demo data already exists for this organization.'))
  })
})
