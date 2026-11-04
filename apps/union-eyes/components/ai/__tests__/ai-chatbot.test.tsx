// @vitest-environment jsdom
// jsdom tests of the AI chatbot against a mocked fetch whose answers have the shape the routes send ({ success, data: { data } } around the session or
// message rows). They prove which routes it calls, that it offers no answer rating and no delete (no route stores either), that archiving goes through
// the archive route and only removes a session the server archived, that the conversation it opens is the one it posts to, that an answer it cannot read
// is a failure and not an empty chat, and that a failure is shown. They prove nothing about the real routes.
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: toasts.toast }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// Radix's menu and scroll area need pointer and layout APIs jsdom lacks; the tests are about what the chatbot does, not the widgets.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: (event: React.MouseEvent) => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(function ScrollArea({ children }, ref) {
    return <div ref={ref}>{children}</div>;
  }),
}));

import { AIChatbot } from '../ai-chatbot';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333';
// Rows of chat_sessions and chat_messages as the routes return them (every column the screen does not read is left out).
const session = (over: Record<string, unknown> = {}) => ({ id: S1, title: 'Grievance help', status: 'active', messageCount: 2, lastMessageAt: '2026-10-20T12:00:00.000Z', ...over });
const sessions = [session(), session({ id: S2, title: 'Safety question', messageCount: 0, lastMessageAt: null })];
const message = (over: Record<string, unknown> = {}) => ({
  id: 'm1', sessionId: S1, role: 'user', content: 'How do I file a grievance?', retrievedDocuments: null, responseTimeMs: null, createdAt: '2026-10-20T12:00:00.000Z', ...over,
});
const transcript = [message(), message({ id: 'm2', role: 'assistant', content: 'Start with your steward.', responseTimeMs: 1500 })];
const rows = (data: unknown) => ({ success: true, data: { data }, timestamp: 'now' });

type Reply = { status?: number; body?: unknown };
type Routes = Record<string, (init?: RequestInit) => Reply>;

function mockServer(overrides: Routes = {}) {
  const calls: string[] = [];
  const bodies: Record<string, unknown> = {};
  const routes: Routes = {
    'GET /api/chatbot/sessions': () => ({ body: rows(sessions) }),
    [`GET /api/chatbot/sessions/${S1}/messages`]: () => ({ body: rows(transcript) }),
    ...overrides,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push(key);
      if (typeof init?.body === 'string') bodies[key] = JSON.parse(init.body);
      const { status = 200, body = {} } = routes[key]?.(init) ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return { calls, bodies };
}

const archiveButtons = (name: RegExp = /^archive$/i) => screen.getAllByRole('button', { name });
const type = (value: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value } });

beforeEach(() => {
  intl.locale = 'en-CA';
  toasts.toast.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AIChatbot: transcript, archive (jsdom, mocked server)', () => {
  it('shows the transcript with the answer time but no way to rate an answer, which no route stores', async () => {
    const { calls } = mockServer();
    render(<AIChatbot />);
    expect(await screen.findByText('Start with your steward.')).toBeInTheDocument();
    expect(screen.getByText('1.5s')).toBeInTheDocument();
    expect(screen.queryByText('Was this helpful?')).not.toBeInTheDocument();
    expect(document.querySelector('svg.lucide-thumbs-up, svg.lucide-thumbs-down')).toBeNull();
    expect(calls.some((call) => call.includes('/feedback'))).toBe(false);
  });

  it('offers Archive for a session and no Delete, which would only have archived it under another name', async () => {
    mockServer();
    render(<AIChatbot />);
    await screen.findByText('Grievance help');
    expect(archiveButtons()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('archives with POST /api/chatbot/sessions/[id]/archive and takes the session off the list once the server has archived it', async () => {
    const { calls } = mockServer({ [`POST /api/chatbot/sessions/${S2}/archive`]: () => ({ body: rows({ id: S2, status: 'archived' }) }) });
    render(<AIChatbot />);
    await screen.findByText('Safety question');
    fireEvent.click(archiveButtons()[1]);

    await waitFor(() => expect(screen.queryByText('Safety question')).not.toBeInTheDocument());
    expect(calls).toContain(`POST /api/chatbot/sessions/${S2}/archive`);
    expect(screen.getByText('Grievance help')).toBeInTheDocument();
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Session archived' }));
  });

  it('closes the open conversation when its own session is archived, without reopening it', async () => {
    const { calls } = mockServer({ [`POST /api/chatbot/sessions/${S1}/archive`]: () => ({ body: rows({ id: S1, status: 'archived' }) }) });
    render(<AIChatbot />);
    await screen.findByText('Start with your steward.');
    fireEvent.click(screen.getAllByText('Grievance help')[0]);
    // The session is the open one once its row is highlighted.
    await waitFor(() => expect(screen.getAllByText('Grievance help')[0].closest('.cursor-pointer')).toHaveClass('bg-accent'));
    const transcriptReads = calls.filter((call) => call === `GET /api/chatbot/sessions/${S1}/messages`).length;

    fireEvent.click(archiveButtons()[0]);
    await waitFor(() => expect(screen.queryByText('Start with your steward.')).not.toBeInTheDocument());
    expect(screen.queryByText('Grievance help')).not.toBeInTheDocument();
    // The menu sits inside the session's row, whose click opens the session; archiving must not also reload it.
    expect(calls.filter((call) => call === `GET /api/chatbot/sessions/${S1}/messages`)).toHaveLength(transcriptReads);
    expect(toasts.toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('keeps the session and says so when the server did not archive it, instead of removing it as though it had', async () => {
    mockServer({ [`POST /api/chatbot/sessions/${S2}/archive`]: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'Chat session not found' } }) });
    render(<AIChatbot />);
    await screen.findByText('Safety question');
    fireEvent.click(archiveButtons()[1]);

    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', description: 'Failed to archive session', variant: 'destructive' })));
    expect(screen.getByText('Safety question')).toBeInTheDocument();
    expect(toasts.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Session archived' }));
  });

  it('speaks French in what it shows and reports when the locale is French', async () => {
    intl.locale = 'fr-CA';
    mockServer({ [`POST /api/chatbot/sessions/${S2}/archive`]: () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal error' } }) });
    render(<AIChatbot />);
    await screen.findByText('Safety question');
    expect(screen.getByText('Historique des conversations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle conversation' })).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Posez une question sur vos droits syndicaux...')).toBeInTheDocument();
    fireEvent.click(archiveButtons(/^archiver$/i)[1]);
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erreur', description: 'Impossible d’archiver la session' })));
  });

  it('does not show the table’s system and function rows as part of the conversation', async () => {
    mockServer({
      [`GET /api/chatbot/sessions/${S1}/messages`]: () => ({
        body: rows([message({ id: 'sys', role: 'system', content: 'Internal instruction' }), ...transcript, message({ id: 'fn', role: 'function', content: 'tool output' })]),
      }),
    });
    render(<AIChatbot />);

    expect(await screen.findByText('Start with your steward.')).toBeInTheDocument();
    expect(screen.queryByText('Internal instruction')).not.toBeInTheDocument();
    expect(screen.queryByText('tool output')).not.toBeInTheDocument();
  });
});

describe('AIChatbot: what cannot be read is a failure, not an empty chat (jsdom, mocked server)', () => {
  it('says when the sessions cannot be loaded, with a way to try again, and shows the chats once a retry works', async () => {
    const answers: Reply[] = [{ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal error' } }, { body: rows(sessions) }];
    const { calls } = mockServer({ 'GET /api/chatbot/sessions': () => answers.shift() ?? { status: 500, body: {} } });
    render(<AIChatbot />);

    expect(await screen.findByText('Chats could not be loaded.')).toBeInTheDocument();
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to load chat sessions', variant: 'destructive' })));
    expect(screen.queryByText('No chats yet.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Grievance help')).toBeInTheDocument();
    expect(calls.filter((call) => call === 'GET /api/chatbot/sessions')).toHaveLength(2);
  });

  it.each([
    ['a bare list', { success: true, data: sessions }],
    ['a body with no data', { success: true }],
    ['a session with no title', rows([session({ title: undefined })])],
    ['a session with no id', rows([session({ id: undefined })])],
    ['a session whose message count is not a count', rows([session({ messageCount: '2' })])],
  ])('treats a sessions answer with %s as a failure to load, not as no chats', async (_what, body) => {
    mockServer({ 'GET /api/chatbot/sessions': () => ({ body }) });
    render(<AIChatbot />);

    expect(await screen.findByText('Chats could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No chats yet.')).not.toBeInTheDocument();
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to load chat sessions' })));
  });

  it('says there are no chats yet, and offers the suggestions, only when the route returns none', async () => {
    mockServer({ 'GET /api/chatbot/sessions': () => ({ body: rows([]) }) });
    render(<AIChatbot />);

    expect(await screen.findByText('No chats yet.')).toBeInTheDocument();
    expect(screen.getByText('How can I help you today?')).toBeInTheDocument();
    expect(toasts.toast).not.toHaveBeenCalled();
  });

  it('says when a conversation cannot be loaded, rather than showing an empty chat', async () => {
    mockServer({ [`GET /api/chatbot/sessions/${S1}/messages`]: () => ({ status: 403, body: { code: 'FORBIDDEN', message: 'Forbidden' } }) });
    render(<AIChatbot />);

    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to load this conversation', variant: 'destructive' })));
    expect(screen.queryByText('Start with your steward.')).not.toBeInTheDocument();
  });

  it.each([
    ['a bare list', { success: true, data: transcript }],
    ['a message with no role', rows([message({ role: undefined })])],
    ['a message from a role that does not exist', rows([message({ role: 'moderator' })])],
    ['a message with no text', rows([message({ content: undefined })])],
    ['citations that are not a list', rows([message({ role: 'assistant', retrievedDocuments: { title: 'x' } })])],
    ['a citation with no score', rows([message({ role: 'assistant', retrievedDocuments: [{ documentId: 'd1', title: 'Agreement' }] })])],
  ])('treats a transcript with %s as a failure to load, not as an empty conversation', async (_what, body) => {
    mockServer({ [`GET /api/chatbot/sessions/${S1}/messages`]: () => ({ body }) });
    render(<AIChatbot />);

    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to load this conversation', variant: 'destructive' })));
    expect(screen.queryByText('How do I file a grievance?')).not.toBeInTheDocument();
  });

  it('shows the conversation that was asked for last when an earlier one answers late', async () => {
    let releaseS2: (reply: Reply) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const reply = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body });
        if (url === '/api/chatbot/sessions') return reply(rows(sessions));
        if (url === `/api/chatbot/sessions/${S1}/messages`) return reply(rows(transcript));
        if (url === `/api/chatbot/sessions/${S2}/messages`) {
          return new Promise((resolve) => {
            releaseS2 = (answer) => resolve({ ok: true, status: 200, json: async () => answer.body });
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      }),
    );
    render(<AIChatbot />);
    await screen.findByText('Start with your steward.');

    fireEvent.click(screen.getByText('Safety question'));
    fireEvent.click(screen.getAllByText('Grievance help')[0]);
    await waitFor(() => expect(screen.getAllByText('Grievance help')[0].closest('.cursor-pointer')).toHaveClass('bg-accent'));
    releaseS2({ body: rows([message({ id: 'late', sessionId: S2, content: 'A late answer for the safety question' })]) });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('A late answer for the safety question')).not.toBeInTheDocument();
    expect(screen.getByText('Start with your steward.')).toBeInTheDocument();
  });
});

describe('AIChatbot: asking a question (jsdom, mocked server)', () => {
  const answer = (over: Record<string, unknown> = {}) =>
    message({
      id: 'a1',
      role: 'assistant',
      content: 'Ask your steward to file it within the time limit.',
      responseTimeMs: 2300,
      retrievedDocuments: [{ documentId: 'd1', title: 'Collective agreement', relevanceScore: 0.874, excerpt: 'Article 12' }],
      ...over,
    });

  it('posts the question to the conversation that was opened, not to a new one, and shows the answer with its sources and the time it took', async () => {
    const { calls, bodies } = mockServer({ 'POST /api/chatbot/messages': () => ({ body: rows(answer()) }) });
    render(<AIChatbot />);
    await screen.findByText('Start with your steward.');

    type('What is the time limit?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Ask your steward to file it within the time limit.')).toBeInTheDocument();
    expect(bodies['POST /api/chatbot/messages']).toEqual({ sessionId: S1, content: 'What is the time limit?', useRAG: true });
    expect(calls).not.toContain('POST /api/chatbot/sessions');
    expect(screen.getByText('What is the time limit?')).toBeInTheDocument();
    expect(screen.getByText('Collective agreement')).toBeInTheDocument();
    expect(screen.getByText('(87% relevant)')).toBeInTheDocument();
    expect(screen.getByText('2.3s')).toBeInTheDocument();
    // The route counts the question and the answer.
    expect(screen.getByText('4 messages')).toBeInTheDocument();
  });

  it('starts a session when there is none, and posts the question to the one the route created', async () => {
    const { bodies } = mockServer({
      'GET /api/chatbot/sessions': () => ({ body: rows([]) }),
      'POST /api/chatbot/sessions': () => ({ status: 201, body: rows(session({ id: S3, title: 'New conversation', messageCount: 0, lastMessageAt: null })) }),
      'POST /api/chatbot/messages': () => ({ body: rows(answer({ sessionId: S3 })) }),
    });
    render(<AIChatbot />);
    await screen.findByText('No chats yet.');

    type('How do I file a grievance?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Ask your steward to file it within the time limit.')).toBeInTheDocument();
    expect(bodies['POST /api/chatbot/messages']).toMatchObject({ sessionId: S3, content: 'How do I file a grievance?' });
    expect(screen.getByText('New conversation')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
  });

  it.each([
    [503, { code: 'EXTERNAL_SERVICE_ERROR', message: 'The assistant is temporarily unavailable.' }],
    [500, {}],
  ])('says the message was not sent (%s) and takes the unanswered question off the conversation', async (status, body) => {
    mockServer({ 'POST /api/chatbot/messages': () => ({ status, body }) });
    render(<AIChatbot />);
    await screen.findByText('Start with your steward.');

    type('What is the time limit?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to send message. Please try again.', variant: 'destructive' })));
    expect(screen.queryByText('What is the time limit?')).not.toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
  });

  it.each([
    ['no message', { success: true, data: {} }],
    ['a message with no content', rows(answer({ content: undefined }))],
    ['a message that is not the assistant’s row', rows('thanks')],
  ])('treats an answer with %s as a failure, not as a reply', async (_what, body) => {
    mockServer({ 'POST /api/chatbot/messages': () => ({ body }) });
    render(<AIChatbot />);
    await screen.findByText('Start with your steward.');

    type('What is the time limit?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to send message. Please try again.' })));
    expect(screen.queryByText('What is the time limit?')).not.toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
  });

  it('says so when a new session cannot be created, so a typed question is not lost silently', async () => {
    mockServer({ 'POST /api/chatbot/sessions': () => ({ status: 400, body: { code: 'BAD_REQUEST', message: 'No active organization' } }) });
    render(<AIChatbot />);
    await screen.findByText('Grievance help');
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }));
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Failed to create new chat session', variant: 'destructive' })));
  });

  it('opens a suggestion as a question in the language of the page', async () => {
    intl.locale = 'fr-CA';
    const { bodies } = mockServer({
      'GET /api/chatbot/sessions': () => ({ body: rows([]) }),
      'POST /api/chatbot/sessions': () => ({ status: 201, body: rows(session({ id: S3, title: 'New conversation', messageCount: 0, lastMessageAt: null })) }),
      'POST /api/chatbot/messages': () => ({ body: rows(answer({ sessionId: S3 })) }),
    });
    render(<AIChatbot />);
    const suggestion = await screen.findByText('Quels sont mes droits au travail ?');

    fireEvent.click(suggestion);

    await waitFor(() => expect(bodies['POST /api/chatbot/messages']).toMatchObject({ sessionId: S3, content: 'Quels sont mes droits au travail ?' }));
    expect(await screen.findByText('Ask your steward to file it within the time limit.')).toBeInTheDocument();
  });
});
