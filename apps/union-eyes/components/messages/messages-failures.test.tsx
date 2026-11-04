// @vitest-environment jsdom
// jsdom tests against a mocked fetch for what the messaging screens do when an answer is not the one the routes promise, when a refresh fails, and when a
// create returns nothing to open. They prove that such answers are shown as failures (never as an empty list or a conversation with no messages), that a list
// that could not be refreshed says so, and that a read marker that did not reach the server is tried again. The fixtures have the shape of
// lib/messaging's ThreadView, MessageView, ThreadDetail and QueueItem. They prove nothing about the real routes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import { MemberMessages } from './member-messages'
import { StaffMessages } from './staff-messages'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

type Handler = (init?: RequestInit) => { status?: number; body?: unknown }
type Routes = Record<string, Handler>
const json = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

function mockServer(routes: Routes) {
  const calls: Array<{ key: string; body: unknown }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`
      calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      const handler = routes[key]
      if (!handler) return json(404, { error: 'NOT_FOUND' })
      const answer = handler(init)
      return json(answer.status ?? 200, answer.body ?? {})
    }),
  )
  return { calls }
}

const T1 = '11111111-1111-4111-8111-111111111111'
const Q1 = '33333333-3333-4333-8333-333333333333'
const ME = 'staff-user-1'
const base = `/api/messages/threads/${T1}`
const LIST = 'GET /api/messages/threads'
const QUEUE = 'GET /api/messages/queue'

const thread = (over: Record<string, unknown> = {}) => ({
  id: T1, subject: 'Overtime dispute', status: 'open', isArchived: false, lastMessageAt: '2026-10-20T12:00:00.000Z',
  createdAt: '2026-10-19T12:00:00.000Z', representativeAssigned: true, viewerRole: 'member', ...over,
})
const detail = (over: Record<string, unknown> = {}) => ({
  id: T1, subject: 'Overtime dispute', status: 'open', isArchived: false, representativeAssigned: true, viewerRole: 'member',
  canReply: true, canClose: true, canArchive: false, retention: { audience: 'member', state: 'not_closed' }, ...over,
})
const message = (over: Record<string, unknown> = {}) => ({
  id: 'm1', fromMe: false, senderKind: 'union', content: 'We are looking at it', createdAt: '2026-10-19T13:00:00.000Z', readByCounterpart: true, ...over,
})
const queueItem = { id: Q1, subject: 'Dues deduction error', category: 'dues', priority: 'high', createdAt: '2026-10-20T10:00:00.000Z' }
// withApi's envelope around the handler's return, and the bare { data } of the handlers that build their own response.
const wrapped = (data: unknown) => ({ success: true, data, timestamp: 'now' })
const bare = (data: unknown) => ({ data })

const memberRoutes = (over: Routes = {}): Routes => ({
  [LIST]: () => ({ body: wrapped({ threads: [thread()] }) }),
  [`GET ${base}`]: () => ({ body: wrapped({ thread: detail() }) }),
  [`GET ${base}/messages`]: () => ({ body: wrapped({ messages: [message()] }) }),
  [`POST ${base}/read`]: () => ({ body: bare({ changed: true }) }),
  ...over,
})
const staffRoutes = (over: Routes = {}): Routes => ({
  [QUEUE]: () => ({ body: wrapped({ queue: [queueItem] }) }),
  [LIST]: () => ({ body: wrapped({ threads: [thread({ viewerRole: 'assignee' })] }) }),
  ...over,
})

const renderMember = (props: { initialThreadId?: string } = {}) =>
  render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <MemberMessages {...props} />
    </NextIntlClientProvider>,
  )
const renderStaff = () =>
  render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <StaffMessages userId={ME} />
    </NextIntlClientProvider>,
  )

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MemberMessages: a list that cannot be read is an error, not an empty list (jsdom, mocked server)', () => {
  it.each([
    ['no list', bare({})],
    ['a record in place of the list', bare({ threads: {} })],
    ['a row with no subject', bare({ threads: [{ id: 'x' }] })],
    ['a row whose time is not a date', bare({ threads: [thread({ createdAt: 'yesterday' })] })],
    ['a body with no data', { threads: [] }],
  ])('shows the list as failed, with a way to try again, when the answer has %s', async (_what, body) => {
    mockServer({ [LIST]: () => ({ body }) })
    renderMember()

    expect(await screen.findByRole('alert')).toHaveTextContent('Your conversations could not be loaded.')
    expect(screen.queryByTestId('messages-empty')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('still says there is nothing for a list that is really empty', async () => {
    mockServer({ [LIST]: () => ({ body: wrapped({ threads: [] }) }) })
    renderMember()

    expect(await screen.findByTestId('messages-empty')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('MemberMessages: a conversation that cannot be read is an error, not an empty conversation (jsdom, mocked server)', () => {
  it.each([
    ['messages that are not a list', { [`GET ${base}/messages`]: () => ({ body: wrapped({ messages: {} }) }) }],
    ['no messages key', { [`GET ${base}/messages`]: () => ({ body: wrapped({}) }) }],
    ['a message whose time is not a date', { [`GET ${base}/messages`]: () => ({ body: wrapped({ messages: [message({ createdAt: 'x' })] }) }) }],
    ['a conversation with no permission to reply', { [`GET ${base}`]: () => ({ body: wrapped({ thread: detail({ canReply: undefined }) }) }) }],
    ['no conversation', { [`GET ${base}`]: () => ({ body: wrapped({}) }) }],
  ])('shows an error with no conversation and no reply form for %s', async (_what, over) => {
    mockServer(memberRoutes(over))
    renderMember({ initialThreadId: T1 })

    expect(await screen.findByText('Your conversations could not be loaded.', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Reply')).not.toBeInTheDocument()
  })

  it('shows a conversation with no messages yet as it is when the route says so', async () => {
    mockServer(memberRoutes({ [`GET ${base}/messages`]: () => ({ body: wrapped({ messages: [] }) }) }))
    renderMember({ initialThreadId: T1 })

    expect(await screen.findByTestId('thread-view')).toBeInTheDocument()
    expect(screen.queryByText('Your conversations could not be loaded.', { selector: 'p' })).not.toBeInTheDocument()
  })
})

describe('MemberMessages: a refresh that fails is said so (jsdom, mocked server)', () => {
  it('keeps the list and the conversation on screen, says the list may be out of date, and takes the notice back when a refresh works', async () => {
    let lists = 0
    mockServer(
      memberRoutes({
        [LIST]: () => {
          lists += 1
          return lists === 2 ? { status: 500, body: {} } : { body: wrapped({ threads: [thread()] }) }
        },
        [`POST ${base}/messages`]: () => ({ status: 201, body: bare({ message: {}, duplicate: false }) }),
      }),
    )
    renderMember({ initialThreadId: T1 })

    const send = async (text: string) => {
      fireEvent.change(await screen.findByLabelText('Reply'), { target: { value: text } })
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    }
    await send('First')

    expect(await screen.findByTestId('refresh-failed')).toHaveTextContent('could not be refreshed')
    expect(screen.getByRole('button', { name: /Overtime dispute/ })).toBeInTheDocument()
    expect(screen.getByTestId('thread-view')).toBeInTheDocument()

    await send('Second')

    await waitFor(() => expect(screen.queryByTestId('refresh-failed')).not.toBeInTheDocument())
  })
})

describe('MemberMessages: the read marker (jsdom, mocked server)', () => {
  const close = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Close conversation' }))
    fireEvent.click(within(await screen.findByTestId('confirm-panel')).getByRole('button', { name: 'Close conversation' }))
  }

  it('is sent again the next time the conversation is loaded when the first attempt did not reach the server', async () => {
    let reads = 0
    mockServer(
      memberRoutes({
        [`POST ${base}/read`]: () => {
          reads += 1
          return reads === 1 ? { status: 500, body: {} } : { body: bare({ changed: true }) }
        },
        [`POST ${base}/lifecycle`]: () => ({ status: 409, body: { error: { code: 'ALREADY_CLOSED' } } }),
      }),
    )
    renderMember({ initialThreadId: T1 })
    await waitFor(() => expect(reads).toBe(1))

    await close()

    await waitFor(() => expect(reads).toBe(2))
  })

  it('is not sent again when the first attempt worked', async () => {
    let reads = 0
    mockServer(
      memberRoutes({
        [`POST ${base}/read`]: () => {
          reads += 1
          return { body: bare({ changed: true }) }
        },
        [`POST ${base}/lifecycle`]: () => ({ status: 409, body: { error: { code: 'ALREADY_CLOSED' } } }),
      }),
    )
    renderMember({ initialThreadId: T1 })
    await waitFor(() => expect(reads).toBe(1))

    await close()
    expect(await screen.findByText(/already changed/)).toBeInTheDocument()

    expect(reads).toBe(1)
  })
})

describe('MemberMessages: starting a conversation (jsdom, mocked server)', () => {
  const compose = async (subject = 'Overtime dispute', body = 'Please check my hours') => {
    fireEvent.click(await screen.findByTestId('new-conversation'))
    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: subject } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: body } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  }

  it('sends the subject and message with a request id, opens the conversation the route created and reads the list again', async () => {
    let created = false
    const server = mockServer(
      memberRoutes({
        [LIST]: () => ({ body: wrapped({ threads: created ? [thread()] : [] }) }),
        'POST /api/messages/threads': () => {
          created = true
          return { status: 201, body: bare({ id: T1 }) }
        },
      }),
    )
    renderMember()
    await compose()

    expect(await screen.findByTestId('thread-view')).toBeInTheDocument()
    const post = server.calls.find((call) => call.key === 'POST /api/messages/threads')?.body as { subject: string; body: string; clientRequestId: string }
    expect(post).toMatchObject({ subject: 'Overtime dispute', body: 'Please check my hours' })
    expect(post.clientRequestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByRole('button', { name: /Overtime dispute/ })).toBeInTheDocument()
  })

  it.each([
    ['a created answer that names no conversation', { status: 201, body: bare({}) }],
    ['a refusal', { status: 403, body: { code: 'FORBIDDEN', message: 'Only members can start a conversation here.' } }],
    ['a server error', { status: 500, body: {} }],
  ])('says the message was not sent, opens nothing and keeps what was typed after %s', async (_what, answer) => {
    mockServer(memberRoutes({ [LIST]: () => ({ body: wrapped({ threads: [] }) }), 'POST /api/messages/threads': () => answer }))
    renderMember()
    await compose()

    expect(await screen.findByRole('alert')).toHaveTextContent('Your message was not sent')
    expect(screen.queryByTestId('thread-view')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toHaveValue('Overtime dispute')
    expect(screen.getByLabelText('Message')).toHaveValue('Please check my hours')
  })
})

describe('StaffMessages: lists that cannot be read are errors, not empty lists (jsdom, mocked server)', () => {
  it.each([
    ['no queue', bare({})],
    ['a record in place of the queue', bare({ queue: {} })],
    ['an entry with no subject', bare({ queue: [{ id: 'x' }] })],
    ['an entry whose time is not a date', bare({ queue: [{ ...queueItem, createdAt: 'x' }] })],
  ])('shows the queue as failed, neither empty nor denied, when the answer has %s', async (_what, body) => {
    mockServer(staffRoutes({ [QUEUE]: () => ({ body }) }))
    renderStaff()

    expect(await screen.findByText('The queue could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByTestId('queue-empty')).not.toBeInTheDocument()
    expect(screen.queryByTestId('queue-denied')).not.toBeInTheDocument()
    expect(screen.queryByTestId('queue-item')).not.toBeInTheDocument()
  })

  it.each([
    ['no list', bare({})],
    ['a row with no archived flag', bare({ threads: [thread({ isArchived: undefined, viewerRole: 'assignee' })] })],
  ])('shows the assigned conversations as failed, not empty, when the answer has %s', async (_what, body) => {
    mockServer(staffRoutes({ [LIST]: () => ({ body }) }))
    renderStaff()

    expect(await screen.findByText('Your conversations could not be loaded.')).toBeInTheDocument()
    expect(screen.queryByTestId('assigned-empty')).not.toBeInTheDocument()
    expect(await screen.findByTestId('queue-item')).toBeInTheDocument()
  })

  it('says the queue or the conversations may be out of date when a refresh after an assignment fails, and keeps what was read', async () => {
    let queues = 0
    mockServer(
      staffRoutes({
        [QUEUE]: () => {
          queues += 1
          return queues === 1 ? { body: wrapped({ queue: [queueItem] }) } : { status: 500, body: {} }
        },
        [`POST /api/messages/threads/${Q1}/assignment`]: () => ({ body: bare({ action: 'assign', staffId: ME }) }),
      }),
    )
    renderStaff()

    fireEvent.click(await screen.findByRole('button', { name: 'Assign to me: Dues deduction error' }))

    expect(await screen.findByTestId('refresh-failed')).toHaveTextContent('could not be refreshed')
    expect(screen.getByTestId('queue-item')).toBeInTheDocument()
  })
})
