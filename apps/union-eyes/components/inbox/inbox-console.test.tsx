// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/onboarding/action-hint', () => ({ ActionHint: () => null }))

import { InboxConsole } from './inbox-console'

const stamp = '2026-05-31T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

// GET /api/claims: the crud factory's list, { data: rows, pagination } inside the withApi body.
const claimsList = (rows: unknown[]) => success({ data: rows, pagination: { page: 1, limit: 100, total: rows.length, totalPages: 1 } })
const claim = (overrides: Record<string, unknown> = {}) => ({
  claimId: '3f2d9c1e-7b6a-4d5e-8c9f-0a1b2c3d4e5f',
  claimNumber: 'CLM-20260530-0001',
  organizationId: 'org-1',
  memberId: 'user-1',
  claimType: 'grievance_discipline',
  status: 'submitted',
  priority: 'high',
  description: 'Suspended without notice after the incident on Friday',
  createdAt: '2026-05-30T09:00:00.000Z',
  updatedAt: '2026-05-30T09:00:00.000Z',
  ...overrides,
})

// GET /api/notifications: { notifications, unreadCount, pagination } inside the withApi body (in_app_notifications rows).
const notificationsBody = (rows: unknown[]) => success({ notifications: rows, unreadCount: rows.length, pagination: { page: 1, limit: 30, total: rows.length, totalPages: 1 } })
const notification = (overrides: Record<string, unknown> = {}) => ({
  id: 'a7f1c2d3-4e5b-4a6c-9d8e-1f2a3b4c5d6e',
  userId: 'user-1',
  organizationId: 'org-1',
  title: 'Conversation assigned',
  message: 'A member conversation was assigned to you',
  type: 'error',
  actionLabel: null,
  actionUrl: null,
  data: { event: 'thread_assigned', threadId: 'thread-9' },
  read: false,
  readAt: null,
  createdAt: '2026-05-30T10:00:00.000Z',
  ...overrides,
})

type Reply = { status?: number; body: unknown } | 'network'
function stubFetch(router: (url: URL) => Reply) {
  const fetchMock = vi.fn(async (input: string) => {
    const reply = router(new URL(input, 'http://localhost'))
    if (reply === 'network') throw new TypeError('Failed to fetch')
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderInbox = () =>
  render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <InboxConsole />
    </NextIntlClientProvider>,
  )

beforeEach(() => nav.push.mockReset())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('inbox console', () => {
  it('lists new claim submissions and notifications read from the shapes the routes answer, and opens each where it belongs', async () => {
    stubFetch((url) => (url.pathname === '/api/claims' ? { body: claimsList([claim()]) } : { body: notificationsBody([notification()]) }))
    const user = userEvent.setup()
    renderInbox()
    expect(await screen.findByText(/grievance discipline: Suspended without notice/)).toBeInTheDocument()
    expect(screen.getByText('Conversation assigned')).toBeInTheDocument()

    const reviewCase = screen.getByRole('button', { name: /Review case/ })
    await user.click(reviewCase)
    expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/claims/3f2d9c1e-7b6a-4d5e-8c9f-0a1b2c3d4e5f')
    await user.click(screen.getByRole('button', { name: /^Open/ }))
    expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/messages/staff?thread=thread-9')
  })

  it('does not offer a "Convert" that only opens a blank claim form', async () => {
    stubFetch((url) => (url.pathname === '/api/claims' ? { body: claimsList([claim()]) } : { body: notificationsBody([]) }))
    renderInbox()
    await screen.findByText(/grievance discipline: Suspended without notice/)
    expect(screen.queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument()
  })

  it('lists only claims that are new submissions (the route does not filter by status), at the urgency the claim states', async () => {
    stubFetch((url) =>
      url.pathname === '/api/claims'
        ? { body: claimsList([claim({ priority: 'critical' }), claim({ claimId: 'c-closed', status: 'closed', description: 'An old closed matter' })]) }
        : { body: notificationsBody([]) },
    )
    renderInbox()
    expect(await screen.findByText(/grievance discipline: Suspended without notice/)).toBeInTheDocument()
    expect(screen.queryByText(/An old closed matter/)).not.toBeInTheDocument()
    // The urgency filter chip is also labelled "Critical": the badge is the one on the signal.
    const signal = screen.getByText(/grievance discipline: Suspended without notice/).closest('[class*="border-l-4"]') as HTMLElement
    expect(within(signal).getByText('Critical')).toBeInTheDocument()
  })

  it('says one source could not be read, and keeps what the other returned', async () => {
    let claimReads = 0
    stubFetch((url) => {
      if (url.pathname === '/api/claims') {
        claimReads += 1
        return claimReads === 1 ? { status: 500, body: failure('INTERNAL_ERROR', 'The claims register is unavailable') } : { body: claimsList([claim()]) }
      }
      return { body: notificationsBody([notification()]) }
    })
    const user = userEvent.setup()
    renderInbox()
    expect(await screen.findByText('The claims register is unavailable')).toBeInTheDocument()
    expect(screen.getByText('Conversation assigned')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/grievance discipline: Suspended without notice/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('does not call an unreadable inbox "no signals yet"', async () => {
    stubFetch((url) => (url.pathname === '/api/claims' ? 'network' : { status: 500, body: failure('INTERNAL_ERROR', 'Notifications are unavailable') }))
    renderInbox()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Notifications are unavailable')
    expect(alert).toHaveTextContent(enCA.errors.loadingError)
    expect(screen.queryByText(enCA.inboxConsole.empty.noSignalsTitle)).not.toBeInTheDocument()
  })

  it('says "no signals" only when both sources answered and neither had anything', async () => {
    stubFetch((url) => (url.pathname === '/api/claims' ? { body: claimsList([]) } : { body: notificationsBody([]) }))
    renderInbox()
    expect(await screen.findByText(enCA.inboxConsole.empty.noSignalsTitle)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
