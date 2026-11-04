// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }))
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA', useTranslations: () => (key: string) => key }))
vi.mock('@/contexts/pilot-mode-context', () => ({ usePilotMode: () => ({ isPilotMode: true }) }))
vi.mock('@/components/onboarding/action-hint', () => ({ ActionHint: () => null }))

import { PrioritiesConsole } from './priorities-console'

const DAY = 24 * 60 * 60 * 1000
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()
const stamp = '2026-05-31T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

// GET /api/deadlines/overdue and /upcoming: the crud factory's list of claim_deadlines, { data: rows, pagination } inside the withApi body.
const deadlineList = (rows: unknown[], total = rows.length) =>
  success({ data: rows, pagination: { page: 1, limit: 100, total, totalPages: Math.max(1, Math.ceil(total / 100)) } })
let deadlineSeq = 0
const deadline = (overrides: Record<string, unknown> = {}) => {
  deadlineSeq += 1
  return {
    id: `d0000000-0000-4000-8000-${String(deadlineSeq).padStart(12, '0')}`,
    claimId: `c0000000-0000-4000-8000-${String(deadlineSeq).padStart(12, '0')}`,
    organizationId: '0c9d6a1e-5f2b-4b7c-8d3e-1a2b3c4d5e6f',
    deadlineRuleId: null,
    deadlineName: 'Step 1 response',
    deadlineType: 'step_response',
    eventDate: at(-30 * DAY),
    originalDeadline: at(DAY),
    dueDate: at(DAY),
    completedAt: null,
    status: 'pending',
    priority: 'medium',
    extensionCount: 0,
    totalExtensionDays: 0,
    lastExtensionDate: null,
    lastExtensionReason: null,
    completedBy: null,
    completionNotes: null,
    isOverdue: false,
    daysUntilDue: null,
    daysOverdue: 0,
    escalatedAt: null,
    escalatedTo: null,
    alertCount: 0,
    lastAlertSent: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  }
}

// GET /api/grievances: standardSuccessResponse(rows), an array at `data`. A case the caller holds is a full row; an unassigned intake is a trimmed triage row.
const grievancesBody = (rows: unknown[]) => success(rows)
const grievanceCase = (overrides: Record<string, unknown> = {}) => ({
  id: 'g0000000-0000-4000-8000-000000000001',
  grievanceNumber: 'GRV-2026-0012',
  type: 'discipline',
  status: 'investigating',
  priority: 'medium',
  title: 'Unpaid overtime on the night shift',
  description: 'Overtime worked on three nights was not paid.',
  responseDeadline: null,
  organizationId: '0c9d6a1e-5f2b-4b7c-8d3e-1a2b3c4d5e6f',
  createdAt: stamp,
  updatedAt: stamp,
  accessScope: 'case',
  ...overrides,
})
const grievanceTriage = (overrides: Record<string, unknown> = {}) => ({
  id: 'g0000000-0000-4000-8000-000000000099',
  grievanceNumber: 'GRV-2026-0099',
  type: 'safety',
  status: 'filed',
  priority: 'medium',
  createdAt: stamp,
  accessScope: 'intake_triage',
  ...overrides,
})

type Reply = { status?: number; body: unknown } | 'network'
function stubFetch(routes: { overdue?: Reply; upcoming?: Reply; grievances?: Reply }) {
  const empty = { body: deadlineList([]) }
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost')
    const reply =
      url.pathname === '/api/deadlines/overdue' ? (routes.overdue ?? empty)
      : url.pathname === '/api/deadlines/upcoming' ? (routes.upcoming ?? empty)
      : url.pathname === '/api/grievances' ? (routes.grievances ?? { body: grievancesBody([]) })
      : ({ status: 404, body: failure('NOT_FOUND', `no route ${url.pathname}`) } as Reply)
    if (reply === 'network') throw new TypeError('Failed to fetch')
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const titles = (container: HTMLElement) => Array.from(container.querySelectorAll('span.font-medium')).map((el) => el.textContent)

beforeEach(() => {
  push.mockReset()
  deadlineSeq = 0
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('priorities console', () => {
  it('ranks what the routes answer: overdue first, oldest first, then urgent items, with reasons computed from the stored dates', async () => {
    const fetchMock = stubFetch({
      overdue: { body: deadlineList([deadline({ deadlineName: 'Step 2 reply', dueDate: at(-9 * DAY) }), deadline({ deadlineName: 'Step 1 response', dueDate: at(-2 * DAY) })]) },
      upcoming: {
        body: deadlineList([
          deadline({ deadlineName: 'Today thing', dueDate: at(5 * 60 * 60 * 1000) }),
          deadline({ deadlineName: 'Tomorrow thing', dueDate: at(30 * 60 * 60 * 1000) }),
          deadline({ deadlineName: 'Arbitration notice', dueDate: at(3 * DAY + 60 * 60 * 1000), priority: 'critical' }),
          deadline({ deadlineName: 'Pay review', dueDate: at(10 * DAY + 60 * 60 * 1000) }),
        ]),
      },
      grievances: {
        body: grievancesBody([
          grievanceCase({ responseDeadline: at(-DAY) }),
          grievanceCase({ id: 'g0000000-0000-4000-8000-000000000002', grievanceNumber: 'GRV-2026-0013', title: 'Disputed termination', status: 'arbitration' }),
          grievanceTriage(),
        ]),
      },
    })
    const { container } = render(<PrioritiesConsole role="steward" />)
    await screen.findByText('Step 2 reply')

    expect(titles(container)).toEqual([
      'Step 2 reply',
      'Step 1 response',
      'Grievance: Unpaid overtime on the night shift',
      'Arbitration notice',
      'Grievance: Disputed termination',
      'Today thing',
      'Tomorrow thing',
      'Pay review',
      'Grievance: GRV-2026-0099',
    ])
    expect(screen.getAllByText('Overdue — action required')).toHaveLength(2)
    expect(screen.getByText('Response deadline passed')).toBeInTheDocument()
    expect(screen.getByText('Due in 3 days')).toBeInTheDocument()
    expect(screen.getByText('Due in 10 days')).toBeInTheDocument()
    expect(screen.getByText('Due tomorrow')).toBeInTheDocument()
    expect(screen.getByText('Due today')).toBeInTheDocument()
    expect(screen.getByText('Status: arbitration')).toBeInTheDocument()
    expect(screen.getByText('Status: filed')).toBeInTheDocument()
    expect(screen.getAllByText('critical')).toHaveLength(3)
    expect(screen.getAllByText('high')).toHaveLength(2)
    expect(screen.getAllByText('normal')).toHaveLength(4)

    // Claims carry no deadline, so they are not read; the active grievances are asked for by status.
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/deadlines/overdue?limit=100',
      '/api/deadlines/upcoming?limit=100',
      '/api/grievances?status=active',
    ])
  })

  it("offers staff their permitted work area, and a member nothing: no organization-wide deadline is requested on a member's behalf", async () => {
    stubFetch({ overdue: { body: deadlineList([deadline({ deadlineName: 'Step 1 response', dueDate: at(-DAY), claimId: 'c0000000-0000-4000-8000-0000000000aa' })]) } })
    const staff = render(<PrioritiesConsole role="steward" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Open my work area' }))
    expect(push).toHaveBeenCalledWith('/en-CA/dashboard/workbench')
    staff.unmount()

    const fetchMock = stubFetch({ overdue: { body: deadlineList([deadline()]) } })
    render(<PrioritiesConsole role="member" />)
    expect(await screen.findByText('Priorities are available to staff who handle cases.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Nothing urgent right now')).not.toBeInTheDocument()
  })

  it('names the source that failed, keeps the ranking of the others, and retries', async () => {
    let refused = true
    stubFetch({
      overdue: { body: deadlineList([deadline({ deadlineName: 'Step 1 response', dueDate: at(-2 * DAY) })]) },
      get grievances() {
        return refused ? { status: 403, body: failure('FORBIDDEN', 'Requires steward role or above') } : { body: grievancesBody([grievanceCase()]) }
      },
    })
    const user = userEvent.setup()
    render(<PrioritiesConsole role="steward" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Some priorities could not be loaded')
    expect(within(alert).getByText('Grievances: Requires steward role or above')).toBeInTheDocument()
    expect(screen.getByText('Step 1 response')).toBeInTheDocument()
    expect(screen.queryByText('Nothing urgent right now')).not.toBeInTheDocument()

    refused = false
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Grievance: Unpaid overtime on the night shift')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not claim an empty successful state when a source fails, a response is not the route shape, or the network is down', async () => {
    stubFetch({ overdue: { status: 500, body: failure('INTERNAL_ERROR', 'Deadlines could not be read') }, upcoming: { body: success({ deadlines: [] }) }, grievances: 'network' })
    render(<PrioritiesConsole role="steward" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Priorities could not be loaded. Retry to see their current state.')
    expect(within(alert).getByText('Overdue deadlines: Deadlines could not be read')).toBeInTheDocument()
    expect(within(alert).getByText('Upcoming deadlines: Unexpected response from the server')).toBeInTheDocument()
    expect(within(alert).getByText('Grievances: Network error')).toBeInTheDocument()
    expect(screen.queryByText('Nothing urgent right now')).not.toBeInTheDocument()
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeEnabled()
  })

  it('fails the source of a malformed row instead of showing a half-built item', async () => {
    const { deadlineName: _dropped, ...malformed } = deadline()
    stubFetch({ overdue: { body: deadlineList([malformed]) }, upcoming: { body: deadlineList([deadline({ deadlineName: 'Pay review', dueDate: at(10 * DAY) })]) } })
    render(<PrioritiesConsole role="steward" />)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Overdue deadlines: Unexpected response from the server')).toBeInTheDocument()
    expect(screen.getByText('Pay review')).toBeInTheDocument()
  })

  it('says nothing is urgent only when every source answered with nothing', async () => {
    stubFetch({})
    render(<PrioritiesConsole role="steward" />)
    expect(await screen.findByText('Nothing urgent right now')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the ten most urgent and says how many items there are in all', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => deadline({ deadlineName: `Overdue ${String(index + 1).padStart(2, '0')}`, dueDate: at(-(30 - index) * DAY) }))
    stubFetch({ overdue: { body: deadlineList(rows, 140) }, grievances: { body: grievancesBody([grievanceCase()]) } })
    const { container } = render(<PrioritiesConsole role="steward" />)
    await screen.findByText('Overdue 01')
    await waitFor(() => expect(titles(container)).toHaveLength(10))
    expect(screen.getByText('Showing the 10 most urgent of 141.')).toBeInTheDocument()
  })

  it('has no my/team switch that would show the same list under two names', async () => {
    stubFetch({})
    render(<PrioritiesConsole role="steward" />)
    await screen.findByText('Nothing urgent right now')
    expect(screen.queryByRole('button', { name: /Team view|My priorities/ })).not.toBeInTheDocument()
  })
})
