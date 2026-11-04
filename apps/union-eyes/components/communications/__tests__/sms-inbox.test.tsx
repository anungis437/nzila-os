// @vitest-environment jsdom
// jsdom tests of the SMS inbox against a mocked fetch. They prove what it reads, that it offers no reply, mark-read or archive (the routes for
// those answer 501 or do not exist, and no sender exists), that it never claims an opt-out was recorded, and what it shows when the server
// refuses. They prove nothing about the real routes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));

import { SmsInbox } from '../sms-inbox';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  organizationId: 'org-1',
  userId: 'user-9',
  phoneNumber: '+15145550100',
  direction: 'inbound',
  message: 'Is the meeting still on Thursday?',
  twilioSid: null,
  status: 'received',
  repliedAt: null,
  readAt: null,
  createdAt: '2026-10-20T10:00:00.000Z',
  ...over,
});

type Reply = { status?: number; body?: unknown };

function mockServer(reply: () => Reply) {
  const calls: Array<{ key: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ key: `${init?.method ?? 'GET'} ${url}` });
      const { status = 200, body = {} } = reply();
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return calls;
}
const list = (...rows: unknown[]) => () => ({ body: { success: true, data: { data: rows, pagination: { page: 1, limit: 50, total: rows.length, totalPages: 1 } } } });

beforeEach(() => {
  intl.locale = 'en-CA';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SmsInbox (jsdom, mocked server)', () => {
  it('lists the stored conversations from the list route, without sending the organization from the browser', async () => {
    const calls = mockServer(list(row(), row({ id: 'c2', phoneNumber: '+14165550111', message: 'Thanks', status: 'read' })));
    render(<SmsInbox />);
    expect(await screen.findByText('+15145550100')).toBeInTheDocument();
    expect(screen.getByText('+14165550111')).toBeInTheDocument();
    expect(screen.getByText('2 conversations')).toBeInTheDocument();
    expect(calls[0].key).toBe('GET /api/communications/sms/conversations');
  });

  it('searches the list by phone number or message', async () => {
    mockServer(list(row(), row({ id: 'c2', phoneNumber: '+14165550111', message: 'Thanks' })));
    render(<SmsInbox />);
    await screen.findByText('+15145550100');
    fireEvent.change(screen.getByPlaceholderText('Search by phone or message...'), { target: { value: 'Thanks' } });
    expect(screen.queryByText('+15145550100')).not.toBeInTheDocument();
    expect(screen.getByText('+14165550111')).toBeInTheDocument();
  });

  it('opens a conversation to read it and calls no route to change it: no mark-read, no archive, no reply', async () => {
    const calls = mockServer(list(row()));
    render(<SmsInbox />);
    fireEvent.click(await screen.findByText('+15145550100'));
    expect(await screen.findByText('Is the meeting still on Thursday?', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('From Member')).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /archive|mark read|send/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /reply/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/type your reply/i)).not.toBeInTheDocument();
    expect(calls.map((call) => call.key)).toEqual(['GET /api/communications/sms/conversations']);
  });

  it('says what the inbox cannot do, instead of offering it', async () => {
    mockServer(list(row()));
    render(<SmsInbox />);
    await screen.findByText('+15145550100');
    expect(screen.getByRole('status')).toHaveTextContent('Replying, marking as read and archiving are not available in this release');
    expect(screen.getByRole('status')).toHaveTextContent('UE-ACTION-SMS-CONVERSATIONS');
  });

  it('flags a whole-message stop word as a possible opt-out and never claims the opt-out was recorded', async () => {
    mockServer(list(row({ id: 'c3', message: ' STOP ' }), row({ id: 'c4', phoneNumber: '+14165550111', message: 'I stopped by the hall' })));
    render(<SmsInbox />);
    fireEvent.click(await screen.findByText('+15145550100'));
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Possible opt-out request');
    expect(notice).toHaveTextContent('not recorded automatically');
    expect(screen.queryByText(/added to the opt-out list/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('+14165550111'));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('says the conversations could not be loaded, with a retry, rather than "No conversations found"', async () => {
    const calls = mockServer(() => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal error' } }));
    render(<SmsInbox />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Internal error');
    expect(screen.queryByText('No conversations found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it('refuses a list whose records are not conversations', async () => {
    mockServer(list({ id: 'x' }));
    render(<SmsInbox />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The conversations could not be loaded.');
    expect(screen.queryByText('No conversations found')).not.toBeInTheDocument();
  });

  it('says that there are no conversations when the list is empty', async () => {
    mockServer(list());
    render(<SmsInbox />);
    expect(await screen.findByText('No conversations found')).toBeInTheDocument();
  });

  it('speaks French when the locale is French', async () => {
    intl.locale = 'fr-CA';
    mockServer(list(row()));
    render(<SmsInbox />);
    await screen.findByText('+15145550100');
    expect(screen.getByRole('status')).toHaveTextContent('ne sont pas disponibles dans cette version');
    expect(screen.getByText('1 conversation')).toBeInTheDocument();
  });
});
