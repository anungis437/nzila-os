// @vitest-environment jsdom
// jsdom component tests against a mocked fetch. They prove what the component renders and sends for each server answer;
// they are NOT a signed-in browser acceptance run, and they prove nothing about the real routes (see the PGlite tests).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import { MemberMessages } from './member-messages'

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

const T1 = '11111111-1111-4111-8111-111111111111'
const thread = (over: Record<string, unknown> = {}) => ({
  id: T1, subject: 'Overtime dispute', status: 'open', isArchived: false, lastMessageAt: '2026-10-20T12:00:00Z',
  createdAt: '2026-10-19T12:00:00Z', representativeAssigned: true, viewerRole: 'member', ...over,
})
const detail = (over: Record<string, unknown> = {}) => ({
  id: T1, subject: 'Overtime dispute', status: 'open', isArchived: false, representativeAssigned: true, viewerRole: 'member',
  canReply: true, canClose: true, canArchive: false, retention: { audience: 'member', state: 'not_closed' }, ...over,
})
const messages = [
  { id: 'm1', fromMe: true, senderKind: 'member', content: 'Please check my hours', createdAt: '2026-10-19T12:00:00Z', readByCounterpart: true },
  { id: 'm2', fromMe: false, senderKind: 'union', content: 'We are looking at it', createdAt: '2026-10-19T13:00:00Z', readByCounterpart: true },
  { id: 'm3', fromMe: true, senderKind: 'member', content: 'Thank you', createdAt: '2026-10-19T14:00:00Z', readByCounterpart: false },
]
const base = `/api/messages/threads/${T1}`
const open = (over: Record<string, unknown> = {}, list: unknown[] = [thread()]): Routes => ({
  'GET /api/messages/threads': () => ({ body: { data: { threads: list } } }),
  [`GET ${base}`]: () => ({ body: { data: { thread: detail(over) } } }),
  [`GET ${base}/messages`]: () => ({ body: { data: { messages } } }),
  [`POST ${base}/read`]: () => ({ body: { data: { changed: true } } }),
})

function renderMember(locale: 'en-CA' | 'fr-CA' = 'en-CA', props: { initialThreadId?: string } = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <MemberMessages {...props} />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('MemberMessages (jsdom, mocked server)', () => {
  it('shows an honest empty state, in French when asked', async () => {
    mockServer({ 'GET /api/messages/threads': () => ({ body: { data: { threads: [] } } }) })
    renderMember('fr-CA')
    expect(await screen.findByText('Aucune conversation pour l’instant')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Messages')
  })

  it('shows a retryable error when the list cannot load', async () => {
    const server = mockServer({})
    server.fetchMock.mockImplementationOnce(() => json(500, {}))
    renderMember()
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded')
    server.fetchMock.mockImplementation(() => json(200, { data: { threads: [thread()] } }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: /Overtime dispute/ })).toBeInTheDocument()
  })

  it('opens a conversation, tells the member what was read and who is assigned without naming anyone, and marks it read', async () => {
    const server = mockServer(open())
    renderMember()
    fireEvent.click(await screen.findByRole('button', { name: /Overtime dispute/ }))
    expect(await screen.findByTestId('thread-view')).toBeInTheDocument()
    expect(screen.getByText('A union representative is assigned')).toBeInTheDocument()
    const own = screen.getAllByTestId('message-read')
    expect(own).toHaveLength(1)
    expect(own[0]).toHaveTextContent('Read by the union')
    expect(screen.getAllByTestId('message-unread')[0]).toHaveTextContent('Sent')
    expect(screen.getAllByText(/Union ·/).length).toBe(1)
    await waitFor(() => expect(server.calls.some((c) => c.key === `POST ${base}/read`)).toBe(true))
    expect(document.body.textContent).not.toMatch(/steward|staff-|member-1/i)
  })

  it('sends a reply with a client request id, then reloads the conversation', async () => {
    const server = mockServer({ ...open(), [`POST ${base}/messages`]: () => ({ status: 201, body: { data: { message: {} } } }) })
    renderMember('en-CA', { initialThreadId: T1 })
    const box = await screen.findByLabelText('Reply')
    fireEvent.change(box, { target: { value: '  Any news?  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(server.calls.some((c) => c.key === `POST ${base}/messages`)).toBe(true))
    const post = server.calls.find((c) => c.key === `POST ${base}/messages`)!.body as { body: string; clientRequestId: string }
    expect(post.body).toBe('Any news?')
    expect(post.clientRequestId).toMatch(/^[0-9a-f-]{36}$/)
    await waitFor(() => expect(screen.getByLabelText('Reply')).toHaveValue(''))
  })

  it('says so when the conversation was closed while replying, and when a reply fails', async () => {
    mockServer({ ...open(), [`POST ${base}/messages`]: () => ({ status: 409, body: { error: { code: 'THREAD_CLOSED' } } }) })
    renderMember('en-CA', { initialThreadId: T1 })
    fireEvent.change(await screen.findByLabelText('Reply'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect((await screen.findAllByText(/This conversation is closed/))[0]).toBeInTheDocument()
    cleanup()
    mockServer({ ...open(), [`POST ${base}/messages`]: () => ({ status: 500 }) })
    renderMember('en-CA', { initialThreadId: T1 })
    fireEvent.change(await screen.findByLabelText('Reply'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('was not sent')
  })

  it('treats a conversation the server will not show as unavailable, never as a blank page', async () => {
    mockServer({ 'GET /api/messages/threads': () => ({ body: { data: { threads: [] } } }) })
    renderMember('en-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('thread-unavailable')).toHaveTextContent('Conversation not available')
    expect(screen.queryByLabelText('Reply')).not.toBeInTheDocument()
  })

  it('closes a conversation only after confirmation, and posts the lifecycle action', async () => {
    const server = mockServer({ ...open(), [`POST ${base}/lifecycle`]: () => ({ body: { data: { action: 'close' } } }) })
    renderMember('en-CA', { initialThreadId: T1 })
    fireEvent.click(await screen.findByRole('button', { name: 'Close conversation' }))
    const confirm = await screen.findByTestId('confirm-panel')
    expect(confirm).toHaveTextContent('Closing is final')
    expect(server.calls.some((c) => c.key === `POST ${base}/lifecycle`)).toBe(false)
    fireEvent.click(within(confirm).getByRole('button', { name: 'Close conversation' }))
    await waitFor(() => expect(server.calls.find((c) => c.key === `POST ${base}/lifecycle`)?.body).toEqual({ action: 'close' }))
  })

  it('shows a conflict and an error from the lifecycle route without losing the conversation', async () => {
    mockServer({ ...open(), [`POST ${base}/lifecycle`]: () => ({ status: 409, body: { error: { code: 'ALREADY_CLOSED' } } }) })
    renderMember('en-CA', { initialThreadId: T1 })
    fireEvent.click(await screen.findByRole('button', { name: 'Close conversation' }))
    fireEvent.click(within(await screen.findByTestId('confirm-panel')).getByRole('button', { name: 'Close conversation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already changed')
    expect(screen.getByTestId('thread-view')).toBeInTheDocument()
  })

  it('a closed conversation has no reply form, offers archive, and says retention policy is not adopted', async () => {
    const server = mockServer({
      ...open({ status: 'closed', canReply: false, canClose: false, canArchive: true, retention: { audience: 'member', state: 'policy_not_adopted' } }, [thread({ status: 'closed' })]),
      [`POST ${base}/lifecycle`]: () => ({ body: { data: { action: 'archive' } } }),
    })
    renderMember('en-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('thread-closed')).toBeInTheDocument()
    expect(screen.queryByLabelText('Reply')).not.toBeInTheDocument()
    expect(screen.getByTestId('retention-note')).toHaveTextContent('Retention policy not adopted')
    expect(screen.queryByRole('button', { name: 'Close conversation' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(server.calls.find((c) => c.key === `POST ${base}/lifecycle`)?.body).toEqual({ action: 'archive' }))
  })

  it('hides archived conversations until asked, and never offers staff controls', async () => {
    mockServer({ 'GET /api/messages/threads': () => ({ body: { data: { threads: [thread(), thread({ id: 'b'.repeat(8) + '-1111-4111-8111-111111111111', subject: 'Old matter', isArchived: true, status: 'closed' })] } } }) })
    renderMember()
    expect(await screen.findByRole('button', { name: /Overtime dispute/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Old matter/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Show archived conversations'))
    expect(await screen.findByRole('button', { name: /Old matter/ })).toBeInTheDocument()
    for (const staffControl of [/release/i, /reassign/i, /assign to/i, /legal hold/i]) {
      expect(screen.queryByText(staffControl)).not.toBeInTheDocument()
    }
  })

  it('renders the conversation, read state and lifecycle copy in French', async () => {
    mockServer(open({ status: 'closed', canReply: false, canClose: false, canArchive: true, retention: { audience: 'member', state: 'retained' } }, [thread({ status: 'closed' })]))
    renderMember('fr-CA', { initialThreadId: T1 })
    expect(await screen.findByTestId('thread-view')).toBeInTheDocument()
    expect(screen.getAllByTestId('message-read')[0]).toHaveTextContent('Lu par le syndicat')
    expect(screen.getAllByTestId('message-unread')[0]).toHaveTextContent('Envoyé')
    expect(screen.getByRole('button', { name: 'Archiver' })).toBeInTheDocument()
    expect(screen.getByTestId('retention-note')).toHaveTextContent('règles de conservation')
    expect(screen.getByRole('group', { name: 'Actions sur la conversation' })).toBeInTheDocument()
  })
})
