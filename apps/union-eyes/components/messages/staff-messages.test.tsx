// @vitest-environment jsdom
// jsdom component tests against a mocked fetch. They prove what the staff workspace renders and sends for each server
// answer (queue denied/empty/error, assignment, reply, release, revocation as the server reports it). They are NOT a
// signed-in browser acceptance run and prove nothing about the real routes; see the PGlite and route tests for those.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import { StaffMessages } from './staff-messages'

type Handler = (init?: RequestInit) => { status?: number; body?: unknown }
type Routes = Record<string, Handler>
const json = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

function mockServer(routes: Routes) {
  const calls: Array<{ key: string; body: unknown }> = []
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const handler = routes[key]
    if (!handler) return json(404, { error: 'NOT_FOUND' })
    const answer = handler(init)
    return json(answer.status ?? 200, answer.body ?? {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}

const ME = 'staff-user-1'
const T1 = '11111111-1111-4111-8111-111111111111'
const Q1 = '33333333-3333-4333-8333-333333333333'
const base = `/api/messages/threads/${T1}`
const queueItem = { id: Q1, subject: 'Dues deduction error', category: 'dues', priority: 'high', createdAt: '2026-10-20T10:00:00Z' }
const assigned = (over: Record<string, unknown> = {}) => ({
  id: T1, subject: 'Overtime dispute', status: 'open', isArchived: false, lastMessageAt: '2026-10-20T12:00:00Z',
  createdAt: '2026-10-19T12:00:00Z', representativeAssigned: true, viewerRole: 'assignee', ...over,
})
const detail = (over: Record<string, unknown> = {}) => ({
  id: T1, subject: 'Overtime dispute', status: 'open', isArchived: false, representativeAssigned: true, viewerRole: 'assignee',
  canReply: true, canClose: true, canArchive: false, retention: { audience: 'staff', state: 'not_closed' }, ...over,
})
const messages = [
  { id: 'm1', fromMe: false, senderKind: 'member', content: 'Please check my hours', createdAt: '2026-10-19T12:00:00Z', readByCounterpart: false },
  { id: 'm2', fromMe: true, senderKind: 'union', content: 'On it', createdAt: '2026-10-19T13:00:00Z', readByCounterpart: true },
]
const live = (over: { queue?: Handler; threads?: unknown[]; detail?: Record<string, unknown> } = {}): Routes => ({
  'GET /api/messages/queue': over.queue ?? (() => ({ body: { data: { queue: [queueItem] } } })),
  'GET /api/messages/threads': () => ({ body: { data: { threads: over.threads ?? [assigned()] } } }),
  [`GET ${base}`]: () => ({ body: { data: { thread: detail(over.detail) } } }),
  [`GET ${base}/messages`]: () => ({ body: { data: { messages } } }),
  [`POST ${base}/read`]: () => ({ body: { data: { changed: true } } }),
})

function renderStaff(locale: 'en-CA' | 'fr-CA' = 'en-CA', props: { initialThreadId?: string } = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <StaffMessages userId={ME} {...props} />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StaffMessages queue (jsdom, mocked server)', () => {
  it('shows the queue as metadata only: subject, category and priority, never a body or an identity', async () => {
    mockServer(live())
    renderStaff()
    const item = await screen.findByTestId('queue-item')
    expect(within(item).getByText('Dues deduction error')).toBeInTheDocument()
    expect(item).toHaveTextContent('dues')
    expect(item).toHaveTextContent('Priority: high')
    expect(screen.getByText(/You see the subject, category and priority only/)).toBeInTheDocument()
    expect(document.querySelector('[data-testid="queue-item"] a')).toBeNull()
    expect(within(item).queryByRole('button', { name: /open|read/i })).not.toBeInTheDocument()
  })

  it('says plainly that the queue needs a designation when the server answers 404, and still lists assigned conversations', async () => {
    mockServer(live({ queue: () => ({ status: 404 }) }))
    renderStaff()
    expect(await screen.findByTestId('queue-denied')).toHaveTextContent('triage designation')
    expect(screen.queryByTestId('queue-item')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Overtime dispute/ })).toBeInTheDocument()
  })

  it('shows an empty queue, an empty assigned list, and a retryable error', async () => {
    mockServer(live({ queue: () => ({ body: { data: { queue: [] } } }), threads: [] }))
    renderStaff()
    expect(await screen.findByTestId('queue-empty')).toHaveTextContent('Nothing is waiting')
    expect(await screen.findByTestId('assigned-empty')).toHaveTextContent('No conversations assigned to you')
    cleanup()

    const server = mockServer(live({ queue: () => ({ status: 500 }) }))
    renderStaff()
    expect(await screen.findByText('The queue could not be loaded.')).toBeInTheDocument()
    server.fetchMock.mockImplementation((url: string) => json(200, url === '/api/messages/queue' ? { data: { queue: [queueItem] } } : { data: { threads: [] } }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0])
    expect(await screen.findByTestId('queue-item')).toBeInTheDocument()
  })

  it('assigns a queued conversation to the signed-in staff member', async () => {
    const queued = [queueItem]
    const server = mockServer({
      ...live({ queue: () => ({ body: { data: { queue: queued } } }) }),
      [`POST /api/messages/threads/${Q1}/assignment`]: () => {
        queued.length = 0
        return { body: { data: { action: 'assign', staffId: ME } } }
      },
    })
    renderStaff()
    fireEvent.click(await screen.findByRole('button', { name: 'Assign to me: Dues deduction error' }))
    await waitFor(() => expect(server.calls.find((c) => c.key === `POST /api/messages/threads/${Q1}/assignment`)?.body).toEqual({ action: 'assign', toStaffId: ME }))
    expect(await screen.findByTestId('queue-empty')).toBeInTheDocument()
  })

  it('assigns to another staff member by id, and explains each refusal', async () => {
    const answers = [
      { status: 422, body: { error: { code: 'ASSIGNEE_NOT_ELIGIBLE' } } },
      { status: 409, body: { error: { code: 'ALREADY_ASSIGNED' } } },
      { status: 404, body: { error: 'NOT_FOUND' } },
      { status: 500, body: {} },
    ]
    let n = 0
    const server = mockServer({ ...live(), [`POST /api/messages/threads/${Q1}/assignment`]: () => answers[n++] })
    renderStaff()
    const input = await screen.findByLabelText('Assign to another staff member (ID)')
    const assign = screen.getByRole('button', { name: 'Assign' })
    expect(assign).toBeDisabled()
    for (const expected of ['not an eligible staff member', 'changed while you were working', 'no longer yours to change', 'could not be saved']) {
      fireEvent.change(input, { target: { value: ' steward-9 ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Assign' }))
      expect(await screen.findByText(new RegExp(expected))).toBeInTheDocument()
    }
    expect(server.calls.filter((c) => c.key.startsWith('POST'))[0].body).toEqual({ action: 'assign', toStaffId: 'steward-9' })
  })
})

describe('StaffMessages conversation (jsdom, mocked server)', () => {
  it('opens an assigned conversation, labels the sides without identities, shows member read state and marks it read', async () => {
    const server = mockServer(live())
    renderStaff()
    fireEvent.click(await screen.findByRole('button', { name: /Overtime dispute/ }))
    expect(await screen.findByTestId('thread-view')).toBeInTheDocument()
    expect(screen.getByText(/Member ·/)).toBeInTheDocument()
    expect(screen.getByText(/You ·/)).toBeInTheDocument()
    expect(screen.getByTestId('message-read')).toHaveTextContent('Read by the member')
    expect(screen.getByText('Please check my hours')).toBeInTheDocument()
    await waitFor(() => expect(server.calls.some((c) => c.key === `POST ${base}/read`)).toBe(true))
    expect(document.body.textContent).not.toMatch(/member-1|memberId|staffId/)
  })

  it('replies, closes after confirmation and releases to the queue after confirmation', async () => {
    const server = mockServer({
      ...live(),
      [`POST ${base}/messages`]: () => ({ status: 201, body: { data: {} } }),
      [`POST ${base}/lifecycle`]: () => ({ body: { data: { action: 'close' } } }),
      [`POST ${base}/assignment`]: () => ({ body: { data: { action: 'release', staffId: null } } }),
    })
    renderStaff('en-CA', { initialThreadId: T1 })
    fireEvent.change(await screen.findByLabelText('Reply to the member'), { target: { value: ' Your hours are corrected ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(server.calls.find((c) => c.key === `POST ${base}/messages`)?.body).toMatchObject({ body: 'Your hours are corrected' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close conversation' }))
    fireEvent.click(within(await screen.findByTestId('confirm-panel')).getByRole('button', { name: 'Close conversation' }))
    await waitFor(() => expect(server.calls.find((c) => c.key === `POST ${base}/lifecycle`)?.body).toEqual({ action: 'close' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Release to queue' }))
    const confirm = await screen.findByTestId('confirm-panel')
    expect(confirm).toHaveTextContent('you will no longer be able to read it')
    fireEvent.click(within(confirm).getByRole('button', { name: 'Release to queue' }))
    await waitFor(() => expect(server.calls.find((c) => c.key === `POST ${base}/assignment`)?.body).toEqual({ action: 'release' }))
    // The conversation leaves the screen once it is no longer the caller's.
    await waitFor(() => expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument())
  })

  it('reassigns by staff id and reports a refusal without leaving the conversation', async () => {
    mockServer({ ...live(), [`POST ${base}/assignment`]: () => ({ status: 422, body: { error: { code: 'ASSIGNEE_NOT_ELIGIBLE' } } }) })
    renderStaff('en-CA', { initialThreadId: T1 })
    fireEvent.change(await screen.findByLabelText('Reassign to another staff member (ID)'), { target: { value: 'nobody' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reassign' }))
    expect(await screen.findByTestId('assignment-error')).toHaveTextContent('not an eligible staff member')
    expect(screen.getByTestId('thread-view')).toBeInTheDocument()
  })

  it('a conversation the server no longer shows (assignment or membership revoked) is unavailable, with no way to reply', async () => {
    mockServer({ ...live(), [`GET ${base}`]: () => ({ status: 404 }), [`GET ${base}/messages`]: () => ({ status: 404 }) })
    renderStaff('en-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('thread-unavailable')).toHaveTextContent('no longer have access')
    expect(screen.queryByLabelText('Reply to the member')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Close conversation|Release/ })).not.toBeInTheDocument()
  })

  it('stops the reply form when the conversation was closed meanwhile, and keeps a failed send retryable', async () => {
    mockServer({ ...live(), [`POST ${base}/messages`]: () => ({ status: 409, body: { error: { code: 'THREAD_CLOSED' } } }) })
    renderStaff('en-CA', { initialThreadId: T1 })
    fireEvent.change(await screen.findByLabelText('Reply to the member'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findAllByText(/No further replies can be sent|closed/))[0]).toBeInTheDocument()
    cleanup()
    mockServer({ ...live(), [`POST ${base}/messages`]: () => ({ status: 500 }) })
    renderStaff('en-CA', { initialThreadId: T1 })
    fireEvent.change(await screen.findByLabelText('Reply to the member'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('was not sent')
    expect(screen.getByLabelText('Reply to the member')).toHaveValue('hi')
  })

  it('states the retention position honestly: not adopted, legal hold, and elapsed without any deletion offered', async () => {
    const closed = { status: 'closed', canReply: false, canClose: false, canArchive: true }
    mockServer(live({ detail: { ...closed, retention: { audience: 'staff', state: 'policy_not_adopted' } } }))
    renderStaff('en-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('retention-note')).toHaveTextContent('Retention policy not adopted')
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Reply to the member')).not.toBeInTheDocument()
    cleanup()

    mockServer(live({ detail: { ...closed, retention: { audience: 'staff', state: 'legal_hold' } } }))
    renderStaff('en-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('retention-note')).toHaveTextContent('legal hold')
    cleanup()

    mockServer(live({ detail: { ...closed, retention: { audience: 'staff', state: 'retention_elapsed', retainedUntil: '2026-01-01T00:00:00Z' } } }))
    renderStaff('en-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('retention-note')).toHaveTextContent('does not delete conversations')
    expect(screen.queryByRole('button', { name: /delete|purge|dispose/i })).not.toBeInTheDocument()
  })

  it('keeps the page usable from the keyboard: labelled controls, a named list and the current conversation marked', async () => {
    mockServer(live())
    renderStaff('en-CA', { initialThreadId: T1 })
    await screen.findByTestId('thread-view')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Member conversations')
    expect(screen.getByRole('region', { name: 'Waiting for assignment' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Assigned to you' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Messages in this conversation' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Conversation actions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Overtime dispute/ })).toHaveAttribute('aria-current', 'true')
  })

  it('renders the whole workspace in French', async () => {
    mockServer(live({ detail: { status: 'closed', canReply: false, canClose: false, canArchive: true, retention: { audience: 'staff', state: 'policy_not_adopted' } } }))
    renderStaff('fr-CA', { initialThreadId: T1 })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Conversations des membres')
    expect(screen.getByRole('region', { name: 'En attente d’attribution' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'M’attribuer : Dues deduction error' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Archiver' })).toBeInTheDocument()
    expect(screen.getByTestId('retention-note')).toHaveTextContent('Politique de conservation non adoptée')
    expect(screen.getByTestId('message-read')).toHaveTextContent('Lu par le membre')
    cleanup()

    mockServer(live({ queue: () => ({ status: 404 }) }))
    renderStaff('fr-CA')
    expect(await screen.findByTestId('queue-denied')).toHaveTextContent('désignation de triage')
  })
})
