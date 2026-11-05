// @vitest-environment jsdom
// The notifications console against a mocked fetch whose answers have the shape the real routes send (GET /api/notifications -> { notifications,
// unreadCount, pagination } inside withApi's envelope; PATCH and DELETE /api/notifications/[id]; POST /api/notifications/mark-all-read). They
// prove the counts are the route's own, that the filters offered are the values the type column holds, that mark-read, mark-all-read and delete
// are shown to have worked only when the route said so (the inbox is read again afterwards), that a failure is shown with the server's message and
// changes nothing, and that an answer the screen cannot read is an error and never an empty inbox or a count of zero. They prove nothing about the
// routes themselves.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { INBOX_CHANGED_EVENT } from '@/lib/notifications/unread-count';

const translate = vi.hoisted(() => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key));
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en-CA' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'en-CA' }) }));
vi.mock('next/link', async () => {
  const React = await import('react');
  return {
    default: ({ href, children, onClick, className }: { href: string; children: React.ReactNode; onClick?: React.MouseEventHandler<HTMLAnchorElement>; className?: string }) =>
      React.createElement('a', { href, onClick, className }, children),
  };
});
// Exit animations are not what is tested, and they keep a removed row in the document until they finish.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: { div: ({ children, className }: { children: React.ReactNode; className?: string }) => React.createElement('div', { className }, children) },
  };
});

import NotificationsConsole from '../notifications-console';

type Reply = { status?: number; body?: unknown };
type Requests = { key: string; body: unknown }[];

const ORG = '0b6f1d7a-3a62-4c6e-8d0b-5a7c9e2f4d11';
const A = '7d9d8a3e-6b1c-4a53-9a2f-0f4e8f7d1b21';
const B = '2c5e4b1a-9d0f-4f7e-8a36-1b7d3c9e5a02';
const C = 'e1a7c3d9-5b24-4d8f-a6e0-3f9b2c7d1e48';
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

// A row of in_app_notifications as the list route answers it.
const notif = (over: Record<string, unknown> = {}) => ({
  id: A,
  userId: 'user_2abc',
  organizationId: ORG,
  title: 'Your case status was updated',
  message: 'Your case is now under review.',
  type: 'info',
  actionLabel: null,
  actionUrl: null,
  data: null,
  read: false,
  readAt: null,
  createdAt: minutesAgo(5),
  expiresAt: null,
  ...over,
});
// withApi's envelope around the list handler's { notifications, unreadCount, pagination }; the counts are the route's, whatever the rows hold.
const inboxBody = (rows: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    notifications: rows,
    unreadCount: rows.filter((row) => row.read === false).length,
    pagination: { page: 1, limit: 100, total: rows.length, totalPages: Math.ceil(rows.length / 100) },
    ...over,
  },
  timestamp: 'now',
});
const item = (record: unknown) => ({ success: true, data: record, timestamp: 'now' });

function mockServer(routes: Record<string, (body: unknown) => Reply>): Requests {
  const requests: Requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      const sent: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      requests.push({ key, body: sent });
      const { status = 200, body = {} } = routes[key]?.(sent) ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return requests;
}

const LIST = 'GET /api/notifications?limit=100';
const keys = (requests: Requests) => requests.map((request) => request.key);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const card = (text: string): HTMLElement => {
  const found = screen.getByText(text).closest('.rounded-lg');
  if (!(found instanceof HTMLElement)) throw new Error(`no card around ${text}`);
  return found;
};
const figure = (label: string) => within(card(label));

describe('notifications console: what it shows (jsdom, mocked server)', () => {
  it("shows the inbox with the route's own counts, not counts worked out from the rows in hand", async () => {
    const rows = [notif({ id: A, title: 'Case updated' }), notif({ id: B, title: 'SLA at risk', type: 'warning', read: true }), notif({ id: C, title: 'Dues reminder' })];
    const requests = mockServer({ [LIST]: () => ({ body: inboxBody(rows, { unreadCount: 7, pagination: { page: 1, limit: 100, total: 57, totalPages: 1 } }) }) });
    render(<NotificationsConsole />);

    expect(await screen.findByText('Case updated')).toBeInTheDocument();
    expect(screen.getByText('SLA at risk')).toBeInTheDocument();
    expect(screen.getByText('Dues reminder')).toBeInTheDocument();
    expect(figure('common.total').getByText('57')).toBeInTheDocument();
    expect(figure('notifications.unread').getByText('7')).toBeInTheDocument();
    expect(screen.getByText('notifications.showingNewest {"shown":3,"total":57}')).toBeInTheDocument();
    expect(keys(requests)).toEqual([LIST]);
  });

  it('shows no figure that nothing writes the data for or that covers only the rows in hand', async () => {
    mockServer({ [LIST]: () => ({ body: inboxBody([notif({ data: { priority: 'urgent', caseNumber: 'C-1', memberName: 'Ada' } })]) }) });
    render(<NotificationsConsole />);

    await screen.findByText('Your case status was updated');
    expect(screen.queryByText('notifications.urgent')).not.toBeInTheDocument();
    expect(screen.queryByText('notifications.today')).not.toBeInTheDocument();
    expect(screen.queryByText('notifications.priority.urgent')).not.toBeInTheDocument();
    expect(screen.queryByText('C-1')).not.toBeInTheDocument();
    expect(screen.queryByText('notifications.showingNewest', { exact: false })).not.toBeInTheDocument();
  });

  it('offers as filters the values the type column holds, and none of the categories that nothing writes', async () => {
    mockServer({ [LIST]: () => ({ body: inboxBody([notif()]) }) });
    render(<NotificationsConsole />);

    await screen.findByText('Your case status was updated');
    const labels = screen.getAllByRole('button', { pressed: false }).map((button) => button.textContent);
    expect(labels).toEqual(expect.arrayContaining(['notifications.types.info', 'notifications.types.success', 'notifications.types.warning', 'notifications.types.error']));
    expect(screen.getByRole('button', { name: 'common.all', pressed: true })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/notifications\.categories|types\.(caseUpdate|grievance|deadline|vote|meeting)/);
  });

  it('shows a type it does not know as the text it holds, not as one of the four it does', async () => {
    mockServer({ [LIST]: () => ({ body: inboxBody([notif({ type: 'case_update' }), notif({ id: B, type: 'warning', title: 'SLA at risk' })]) }) });
    render(<NotificationsConsole />);

    await screen.findByText('SLA at risk');
    expect(within(card('Your case status was updated')).getByText('case update')).toBeInTheDocument();
    expect(within(card('SLA at risk')).getByText('notifications.types.warning')).toBeInTheDocument();
  });

  it('words how long ago it arrived, and shows — for a time it cannot read', async () => {
    const rows = [notif({ title: 'Recent', createdAt: minutesAgo(5) }), notif({ id: B, title: 'Odd', createdAt: 'not a date' })];
    mockServer({ [LIST]: () => ({ body: inboxBody(rows) }) });
    render(<NotificationsConsole />);

    await screen.findByText('Recent');
    expect(within(card('Recent')).getByText('notifications.minutesAgo {"minutes":5}')).toBeInTheDocument();
    expect(within(card('Odd')).getByText('—')).toBeInTheDocument();
  });

  it('links an action under the locale of the page, with the label the row gives or the common one', async () => {
    const requests = mockServer({
      [LIST]: () => ({
        body: inboxBody([notif({ title: 'Case', actionUrl: '/dashboard/claims/42', actionLabel: 'View case' }), notif({ id: B, title: 'Alert', actionUrl: '/dashboard/alerts' })]),
      }),
    });
    render(<NotificationsConsole />);

    await screen.findByText('Case');
    const link = within(card('Case')).getByRole('link', { name: 'View case' });
    expect(link).toHaveAttribute('href', '/en-CA/dashboard/claims/42');
    expect(within(card('Alert')).getByRole('link', { name: 'common.view' })).toHaveAttribute('href', '/en-CA/dashboard/alerts');
    link.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(link);
    expect(keys(requests)).toEqual([LIST]);
  });

  it('links to the preferences page that exists', async () => {
    mockServer({ [LIST]: () => ({ body: inboxBody([notif()]) }) });
    render(<NotificationsConsole />);

    await screen.findByText('Your case status was updated');
    expect(screen.getByRole('link', { name: 'notifications.preferencesLink' })).toHaveAttribute('href', '/en-CA/dashboard/settings/communications');
  });
});

describe('notifications console: an empty inbox and its filters (jsdom, mocked server)', () => {
  it('says there is nothing, with the zeros the route sent, for an inbox that is really empty', async () => {
    mockServer({ [LIST]: () => ({ body: inboxBody([]) }) });
    render(<NotificationsConsole />);

    expect(await screen.findByText('notifications.noNotifications')).toBeInTheDocument();
    expect(screen.getByText('notifications.youreAllCaughtUp')).toBeInTheDocument();
    expect(figure('common.total').getByText('0')).toBeInTheDocument();
    expect(figure('notifications.unread').getByText('0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifications\.markAllRead/ })).not.toBeInTheDocument();
  });

  it('asks the route for the type and the unread filter chosen, and says what a filter that matches nothing means', async () => {
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody([notif()]) }),
      'GET /api/notifications?limit=100&type=warning': () => ({ body: inboxBody([], { unreadCount: 1 }) }),
      'GET /api/notifications?limit=100&unreadOnly=true&type=warning': () => ({ body: inboxBody([], { unreadCount: 1 }) }),
    });
    render(<NotificationsConsole />);

    await screen.findByText('Your case status was updated');
    fireEvent.click(screen.getByRole('button', { name: 'notifications.types.warning' }));

    expect(await screen.findByText('notifications.noMatch')).toBeInTheDocument();
    expect(screen.queryByText('notifications.noNotifications')).not.toBeInTheDocument();
    expect(figure('common.total').getByText('notifications.matching')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /notifications\.showUnreadOnly/ }));
    await waitFor(() => expect(keys(requests)).toContain('GET /api/notifications?limit=100&unreadOnly=true&type=warning'));

    fireEvent.click(await screen.findByRole('button', { name: 'notifications.clearFilters' }));
    expect(await screen.findByText('Your case status was updated')).toBeInTheDocument();
    expect(keys(requests).filter((key) => key === LIST)).toHaveLength(2);
  });

  it('says there is nothing unread, not that there is nothing, when only the unread filter matches nothing', async () => {
    mockServer({
      [LIST]: () => ({ body: inboxBody([notif({ read: true })]) }),
      'GET /api/notifications?limit=100&unreadOnly=true': () => ({ body: inboxBody([], { unreadCount: 0, pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }) }),
    });
    render(<NotificationsConsole />);

    await screen.findByText('Your case status was updated');
    fireEvent.click(screen.getByRole('button', { name: /notifications\.showUnreadOnly/ }));

    expect(await screen.findByText('notifications.allCaughtUp')).toBeInTheDocument();
    expect(screen.getByText('notifications.noUnread')).toBeInTheDocument();
  });

  it('keeps the rows of the previous filter dimmed and inert until the answer for the chosen one arrives', async () => {
    let release: (reply: Reply) => void = () => undefined;
    const requests: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const key = `${init?.method ?? 'GET'} ${url}`;
        requests.push(key);
        if (key === LIST) return Promise.resolve({ ok: true, status: 200, json: async () => inboxBody([notif({ title: 'Old row' })]) });
        if (key === 'GET /api/notifications?limit=100&type=error') {
          return new Promise((resolve) => {
            release = (reply) => resolve({ ok: true, status: 200, json: async () => reply.body });
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({ message: `no route ${key}` }) });
      }),
    );
    render(<NotificationsConsole />);

    await screen.findByText('Old row');
    fireEvent.click(screen.getByRole('button', { name: 'notifications.types.error' }));

    await waitFor(() => expect(screen.getByText('Old row').closest('[aria-busy="true"]')).not.toBeNull());
    fireEvent.click(screen.getByText('Old row'));
    expect(within(card('Old row')).getByRole('button', { name: 'notifications.deleteNotification' })).toBeDisabled();
    expect(requests).toEqual([LIST, 'GET /api/notifications?limit=100&type=error']);

    release({ body: inboxBody([notif({ id: B, title: 'New row', type: 'error' })]) });
    expect(await screen.findByText('New row')).toBeInTheDocument();
    expect(screen.queryByText('Old row')).not.toBeInTheDocument();
  });
});

describe('notifications console: mark as read, mark all read and delete (jsdom, mocked server)', () => {
  it('marks a notification read, and shows it so only after the route said so and the inbox was read again', async () => {
    let rows = [notif({ id: A, title: 'Case updated' }), notif({ id: B, title: 'SLA at risk', type: 'warning' })];
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody(rows) }),
      [`PATCH /api/notifications/${A}`]: () => {
        rows = rows.map((row) => (row.id === A ? { ...row, read: true, readAt: '2026-03-04T16:00:00.000Z' } : row));
        return { body: item(rows[0]) };
      },
    });
    render(<NotificationsConsole />);

    await screen.findByText('Case updated');
    expect(figure('notifications.unread').getByText('2')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Case updated'));

    await waitFor(() => expect(figure('notifications.unread').getByText('1')).toBeInTheDocument());
    expect(requests.find((request) => request.key === `PATCH /api/notifications/${A}`)?.body).toEqual({ read: true });
    expect(keys(requests)).toEqual([LIST, `PATCH /api/notifications/${A}`, LIST]);
  });

  it('does not ask the route to mark a notification that is already read', async () => {
    const requests = mockServer({ [LIST]: () => ({ body: inboxBody([notif({ read: true, readAt: '2026-03-04T16:00:00.000Z' })]) }) });
    render(<NotificationsConsole />);

    fireEvent.click(await screen.findByText('Your case status was updated'));

    expect(keys(requests)).toEqual([LIST]);
  });

  it.each([
    [404, { code: 'NOT_FOUND', message: 'Notification not found' }, 'Notification not found'],
    [500, {}, 'notifications.markReadFailed'],
  ])('shows why a notification could not be marked read (%s), changes nothing and does not read the inbox again', async (status, answer, shown) => {
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody([notif({ id: A, title: 'Case updated' })]) }),
      [`PATCH /api/notifications/${A}`]: () => ({ status, body: answer }),
    });
    render(<NotificationsConsole />);

    await screen.findByText('Case updated');
    fireEvent.click(screen.getByText('Case updated'));

    expect(await screen.findByText(shown)).toBeInTheDocument();
    expect(figure('notifications.unread').getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Case updated')).toBeInTheDocument();
    expect(keys(requests)).toEqual([LIST, `PATCH /api/notifications/${A}`]);
  });

  it('marks everything read through the route, and offers the action only while the route says something is unread', async () => {
    let rows = [notif({ id: A, title: 'Case updated' }), notif({ id: B, title: 'SLA at risk' })];
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody(rows) }),
      'POST /api/notifications/mark-all-read': () => {
        rows = rows.map((row) => ({ ...row, read: true }));
        return { body: item({ success: true, updated: 2 }) };
      },
    });
    render(<NotificationsConsole />);

    fireEvent.click(await screen.findByRole('button', { name: /notifications\.markAllRead/ }));

    await waitFor(() => expect(figure('notifications.unread').getByText('0')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /notifications\.markAllRead/ })).not.toBeInTheDocument();
    expect(keys(requests)).toEqual([LIST, 'POST /api/notifications/mark-all-read', LIST]);
  });

  it('shows why everything could not be marked read, and leaves the counts and the action as they were', async () => {
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody([notif()]) }),
      'POST /api/notifications/mark-all-read': () => ({ status: 400, body: { code: 'BAD_REQUEST', message: 'Organization context required' } }),
    });
    render(<NotificationsConsole />);

    fireEvent.click(await screen.findByRole('button', { name: /notifications\.markAllRead/ }));

    expect(await screen.findByText('Organization context required')).toBeInTheDocument();
    expect(figure('notifications.unread').getByText('1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications\.markAllRead/ })).toBeEnabled();
    expect(keys(requests)).toEqual([LIST, 'POST /api/notifications/mark-all-read']);
  });

  it('deletes a notification through the route, reads the inbox again, and does not also mark it read', async () => {
    let rows = [notif({ id: A, title: 'Case updated' }), notif({ id: B, title: 'SLA at risk' })];
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody(rows) }),
      [`DELETE /api/notifications/${A}`]: () => {
        rows = rows.filter((row) => row.id !== A);
        return { body: item({ success: true }) };
      },
    });
    render(<NotificationsConsole />);

    await screen.findByText('Case updated');
    fireEvent.click(within(card('Case updated')).getByRole('button', { name: 'notifications.deleteNotification' }));

    await waitFor(() => expect(screen.queryByText('Case updated')).not.toBeInTheDocument());
    expect(screen.getByText('SLA at risk')).toBeInTheDocument();
    expect(figure('notifications.unread').getByText('1')).toBeInTheDocument();
    expect(keys(requests)).toEqual([LIST, `DELETE /api/notifications/${A}`, LIST]);
  });

  it('shows why a notification could not be deleted and keeps it', async () => {
    const requests = mockServer({
      [LIST]: () => ({ body: inboxBody([notif({ id: A, title: 'Case updated' })]) }),
      [`DELETE /api/notifications/${A}`]: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'Notification not found' } }),
    });
    render(<NotificationsConsole />);

    await screen.findByText('Case updated');
    fireEvent.click(within(card('Case updated')).getByRole('button', { name: 'notifications.deleteNotification' }));

    expect(await screen.findByText('Notification not found')).toBeInTheDocument();
    expect(screen.getByText('Case updated')).toBeInTheDocument();
    expect(keys(requests)).toEqual([LIST, `DELETE /api/notifications/${A}`]);
  });

  it('shows the failure of the request itself, not a success, when the network drops during an action', async () => {
    let first = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        if (first) {
          first = false;
          return Promise.resolve({ ok: true, status: 200, json: async () => inboxBody([notif({ id: A, title: 'Case updated' })]) });
        }
        return Promise.reject(new TypeError('Failed to fetch'));
      }),
    );
    render(<NotificationsConsole />);

    await screen.findByText('Case updated');
    fireEvent.click(screen.getByText('Case updated'));

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
    expect(figure('notifications.unread').getByText('1')).toBeInTheDocument();
  });
});

describe('notifications console: an inbox that could not be read (jsdom, mocked server)', () => {
  it("shows the server's message with a way to try again, and no figure, when the read is refused", async () => {
    let answers = [{ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }, { status: 200, body: inboxBody([notif({ title: 'Case updated' })]) }];
    const requests = mockServer({ [LIST]: () => answers.shift() ?? { status: 500, body: {} } });
    render(<NotificationsConsole />);

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('common.total')).not.toBeInTheDocument();
    expect(screen.queryByText('notifications.noNotifications')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /common\.retry/ }));

    expect(await screen.findByText('Case updated')).toBeInTheDocument();
    expect(keys(requests)).toEqual([LIST, LIST]);
    answers = [];
  });

  it('says it could not load, not that there is nothing, when the refusal carries no message', async () => {
    mockServer({ [LIST]: () => ({ status: 500, body: {} }) });
    render(<NotificationsConsole />);

    expect(await screen.findByText('notifications.loadFailed')).toBeInTheDocument();
    expect(screen.queryByText('notifications.noNotifications')).not.toBeInTheDocument();
  });

  it.each([
    ['no unread count', inboxBody([notif()], { unreadCount: undefined })],
    ['an unread count that is not a number', inboxBody([notif()], { unreadCount: 'none' })],
    ['no total', inboxBody([notif()], { pagination: { page: 1, limit: 100, totalPages: 1 } })],
    ['no list of notifications', inboxBody([notif()], { notifications: undefined })],
    ['a row with no read flag', inboxBody([notif({ read: undefined })])],
    ['a row with no id', inboxBody([notif({ id: undefined })])],
    ['a body with no data', { success: true }],
  ])('treats an answer with %s as an error, not as an empty inbox or an unread count of zero', async (_what, body) => {
    mockServer({ [LIST]: () => ({ body }) });
    render(<NotificationsConsole />);

    expect(await screen.findByText('notifications.loadFailed')).toBeInTheDocument();
    expect(screen.queryByText('notifications.noNotifications')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the failure of the request itself as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<NotificationsConsole />);

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
    expect(screen.queryByText('notifications.noNotifications')).not.toBeInTheDocument();
  });
});

describe('notifications console: the header bell is told when the inbox changed (jsdom, mocked server)', () => {
  const changed = vi.fn();
  beforeEach(() => {
    changed.mockClear();
    window.addEventListener(INBOX_CHANGED_EVENT, changed);
  });
  afterEach(() => window.removeEventListener(INBOX_CHANGED_EVENT, changed));

  it('announces a notification marked read, one marked deleted and everything marked read, once each, only after the route confirmed it', async () => {
    let rows = [notif({ id: A, title: 'Case updated' }), notif({ id: B, title: 'SLA at risk' }), notif({ id: C, title: 'Dues reminder' })];
    mockServer({
      [LIST]: () => ({ body: inboxBody(rows) }),
      [`PATCH /api/notifications/${A}`]: () => {
        rows = rows.map((row) => (row.id === A ? { ...row, read: true } : row));
        return { body: item(rows[0]) };
      },
      [`DELETE /api/notifications/${B}`]: () => {
        rows = rows.filter((row) => row.id !== B);
        return { body: item({ success: true }) };
      },
      'POST /api/notifications/mark-all-read': () => {
        rows = rows.map((row) => ({ ...row, read: true }));
        return { body: item({ success: true, updated: 1 }) };
      },
    });
    render(<NotificationsConsole />);
    await screen.findByText('Case updated');
    expect(changed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Case updated'));
    await waitFor(() => expect(figure('notifications.unread').getByText('2')).toBeInTheDocument());
    expect(changed).toHaveBeenCalledTimes(1);

    fireEvent.click(within(card('SLA at risk')).getByRole('button', { name: 'notifications.deleteNotification' }));
    await waitFor(() => expect(screen.queryByText('SLA at risk')).not.toBeInTheDocument());
    expect(changed).toHaveBeenCalledTimes(2);

    fireEvent.click(await screen.findByRole('button', { name: /notifications\.markAllRead/ }));
    await waitFor(() => expect(figure('notifications.unread').getByText('0')).toBeInTheDocument());
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it('announces nothing when the route refused the change', async () => {
    mockServer({
      [LIST]: () => ({ body: inboxBody([notif({ id: A, title: 'Case updated' })]) }),
      [`PATCH /api/notifications/${A}`]: () => ({ status: 404, body: { code: 'NOT_FOUND', message: 'Notification not found' } }),
      [`DELETE /api/notifications/${A}`]: () => ({ status: 500, body: {} }),
      'POST /api/notifications/mark-all-read': () => ({ status: 400, body: { code: 'BAD_REQUEST', message: 'Organization context required' } }),
    });
    render(<NotificationsConsole />);
    await screen.findByText('Case updated');

    fireEvent.click(screen.getByText('Case updated'));
    await screen.findByText('Notification not found');
    fireEvent.click(within(card('Case updated')).getByRole('button', { name: 'notifications.deleteNotification' }));
    await screen.findByText('notifications.deleteFailed');
    fireEvent.click(screen.getByRole('button', { name: /notifications\.markAllRead/ }));
    await screen.findByText('Organization context required');

    expect(changed).not.toHaveBeenCalled();
  });
});
