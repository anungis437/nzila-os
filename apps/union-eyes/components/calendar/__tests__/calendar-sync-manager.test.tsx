// @vitest-environment jsdom
// The calendar sync dialog against a mocked fetch whose answers have the shape of GET /api/calendar-sync/connections and DELETE
// /api/calendar-sync/connections/[id]. They prove the dialog says that synchronizing is not available and offers no control that would only look
// as though it synchronized anything (connect, sync now, auto-sync, direction), lists the connections the route returns, disconnects through the
// route and tells what became of the provider's grant, and shows a failure (never an empty list or a disconnection that did not happen). They
// prove nothing about the routes themselves.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { CalendarSyncManager } from '../CalendarSyncManager';

type Reply = { status?: number; body?: unknown };

const C1 = '11111111-1111-4111-8111-111111111111';
const C2 = '22222222-2222-4222-8222-222222222222';

// A row as the list route selects it: no credential, no mapping and no error text.
const connection = (over: Record<string, unknown> = {}) => ({
  id: C1,
  provider: 'google',
  providerAccountId: '1029384756',
  providerEmail: 'ada@example.org',
  syncEnabled: true,
  syncDirection: 'both',
  lastSyncAt: null,
  nextSyncAt: null,
  syncStatus: 'pending',
  isActive: true,
  createdAt: '2026-02-01T15:00:00.000Z',
  ...over,
});
const list = (rows: unknown[]) => ({ success: true, data: { connections: rows }, timestamp: 'now' });
const deleted = (providerRevocation: unknown, id = C1) => ({
  success: true,
  data: { deleted: true, id, providerRevocation, providerRevocationVerified: providerRevocation === 'revoked' },
  timestamp: 'now',
});

const LIST = 'GET /api/calendar-sync/connections';

function mockServer(routes: Record<string, () => Reply>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push(key);
      const { status = 200, body = {} } = routes[key]?.() ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return calls;
}

const renderManager = (open = true) => render(<CalendarSyncManager open={open} onOpenChange={() => undefined} />);

beforeEach(() => {
  intl.locale = 'en-CA';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CalendarSyncManager: what it says and offers (jsdom, mocked server)', () => {
  it('reads nothing and shows nothing while it is closed', async () => {
    const calls = mockServer({ [LIST]: () => ({ body: list([]) }) });
    renderManager(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it('shows the notice and offers no way to connect, sync or set sync options, since nothing would be synchronized', async () => {
    mockServer({ [LIST]: () => ({ body: list([connection()]) }) });
    renderManager();

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('ada@example.org');
    expect(within(dialog).getByText('UE-ACTION-CALENDAR-SYNC')).toBeInTheDocument();
    expect(within(dialog).getByText('Not available in this release')).toBeInTheDocument();
    expect(within(dialog).getByText(/Connecting a Google or Outlook calendar is turned off/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /connect (google|outlook)|sync now/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/auto-sync|sync direction|last synced|import only|two-way/i)).not.toBeInTheDocument();
  });

  it('says it in French for a French reader', async () => {
    intl.locale = 'fr-CA';
    mockServer({ [LIST]: () => ({ body: list([connection()]) }) });
    renderManager();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Synchronisation du calendrier')).toBeInTheDocument();
    expect(within(dialog).getByText('Non disponible dans cette version')).toBeInTheDocument();
    expect(await within(dialog).findByText('Calendrier Google')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Déconnecter' })).toBeInTheDocument();
  });
});

describe('CalendarSyncManager: the connections it lists (jsdom, mocked server)', () => {
  it('lists each connection by its provider, the account it is for and the day it was connected', async () => {
    mockServer({
      [LIST]: () => ({ body: list([connection(), connection({ id: C2, provider: 'microsoft', providerEmail: null, providerAccountId: 'outlook-account-7', createdAt: '2026-03-04T10:00:00.000Z' })]) }),
    });
    renderManager();

    expect(await screen.findByText('ada@example.org')).toBeInTheDocument();
    expect(screen.getByText('Google Calendar')).toBeInTheDocument();
    expect(screen.getByText('Outlook Calendar')).toBeInTheDocument();
    expect(screen.getByText('outlook-account-7')).toBeInTheDocument();
    expect(screen.getAllByText(/^Connected on /)).toHaveLength(2);
  });

  it('says there is nothing connected only when the route returns no connection', async () => {
    mockServer({ [LIST]: () => ({ body: list([]) }) });
    renderManager();

    expect(await screen.findByText('No external calendars are connected.')).toBeInTheDocument();
    // The only alert is the notice that synchronizing is not available.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Connected calendars could not be loaded.')).not.toBeInTheDocument();
  });

  it("shows the server's message with a way to try again, not an empty list, when the read is refused, and the list once a retry works", async () => {
    const answers: Reply[] = [{ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }, { body: list([connection()]) }];
    const calls = mockServer({ [LIST]: () => answers.shift() ?? { status: 500, body: {} } });
    renderManager();

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No external calendars are connected.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('ada@example.org')).toBeInTheDocument();
    expect(calls).toEqual([LIST, LIST]);
  });

  it.each([
    ['no list', { success: true, data: {} }],
    ['a list that is not a list', { success: true, data: { connections: connection() } }],
    ['a body with no data', { success: true }],
    ['a connection with no id', list([connection({ id: undefined })])],
    ['a connection with no provider', list([connection({ provider: undefined })])],
    ['a connection with no account', list([connection({ providerEmail: null, providerAccountId: undefined })])],
    ['a connection whose time is not a date', list([connection({ createdAt: 'x' })])],
  ])('says the connections could not be loaded, not that there are none, when the answer has %s', async (_what, body) => {
    mockServer({ [LIST]: () => ({ body }) });
    renderManager();

    expect(await screen.findByText('Connected calendars could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No external calendars are connected.')).not.toBeInTheDocument();
  });

  it('shows the failure of the request itself as an error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderManager();

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
    expect(screen.queryByText('No external calendars are connected.')).not.toBeInTheDocument();
  });
});

describe('CalendarSyncManager: disconnecting (jsdom, mocked server)', () => {
  const DELETE_C1 = `DELETE /api/calendar-sync/connections/${C1}`;

  async function startDisconnect() {
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    return screen.findByRole('group', { name: 'Disconnect' });
  }

  it('asks first, and does nothing when the question is declined', async () => {
    const calls = mockServer({ [LIST]: () => ({ body: list([connection()]) }) });
    renderManager();

    const confirm = await startDisconnect();
    expect(confirm).toHaveTextContent('Disconnect ada@example.org? The access stored here is removed.');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: 'Disconnect' })).not.toBeInTheDocument();
    expect(calls).toEqual([LIST]);
  });

  it.each([
    ['revoked', 'google', 'Disconnected. Access was revoked at Google.'],
    ['failed', 'google', /Disconnected here, but Google did not confirm that access was revoked/],
    ['not_supported', 'microsoft', /Disconnected here\. Microsoft cannot be asked to revoke access from this app/],
  ])('disconnects through the route, tells what became of the provider’s grant (%s), and reads the list again', async (revocation, provider, said) => {
    let rows = [connection({ provider })];
    const calls = mockServer({
      [LIST]: () => ({ body: list(rows) }),
      [DELETE_C1]: () => {
        rows = [];
        return { body: deleted(revocation) };
      },
    });
    renderManager();

    const confirm = await startDisconnect();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText(said)).toBeInTheDocument();
    expect(await screen.findByText('No external calendars are connected.')).toBeInTheDocument();
    expect(calls).toEqual([LIST, DELETE_C1, LIST]);
  });

  it('says the provider’s revocation could not be confirmed, and still shows the connection gone, when the answer of a successful disconnect cannot be read', async () => {
    let rows = [connection()];
    mockServer({
      [LIST]: () => ({ body: list(rows) }),
      [DELETE_C1]: () => {
        rows = [];
        return { body: {} };
      },
    });
    renderManager();

    fireEvent.click(within(await startDisconnect()).getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText(/did not confirm that access was revoked/)).toBeInTheDocument();
    expect(await screen.findByText('No external calendars are connected.')).toBeInTheDocument();
  });

  it.each([
    [404, { code: 'NOT_FOUND', message: 'Calendar connection not found' }, 'Calendar connection not found'],
    [500, {}, 'The calendar could not be disconnected.'],
  ])('shows why it could not disconnect (%s), keeps the connection listed and does not read the list again', async (status, answer, shown) => {
    const calls = mockServer({ [LIST]: () => ({ body: list([connection()]) }), [DELETE_C1]: () => ({ status, body: answer }) });
    renderManager();

    fireEvent.click(within(await startDisconnect()).getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText(shown)).toBeInTheDocument();
    expect(screen.getByText('ada@example.org')).toBeInTheDocument();
    expect(calls).toEqual([LIST, DELETE_C1]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).toBeEnabled());
  });
});

describe('CalendarSyncManager: closing and reopening (jsdom, mocked server)', () => {
  it('reads the connections again when it is opened again', async () => {
    const calls = mockServer({ [LIST]: () => ({ body: list([connection()]) }) });
    const view = renderManager();
    await screen.findByText('ada@example.org');

    view.rerender(<CalendarSyncManager open={false} onOpenChange={() => undefined} />);
    view.rerender(<CalendarSyncManager open onOpenChange={() => undefined} />);

    await waitFor(() => expect(calls).toEqual([LIST, LIST]));
  });
});
