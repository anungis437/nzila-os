import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  process.env.MICROSOFT_CALENDAR_CLIENT_ID = 'cid';
  process.env.MICROSOFT_CALENDAR_CLIENT_SECRET = 'secret';
  process.env.MICROSOFT_CALENDAR_REDIRECT_URI = 'http://localhost/cb';
  return {
    readQueue: [] as unknown[],
    graphGet: { value: [] } as Record<string, unknown>,
    authProviderCalled: false,
  };
});

function makeChain(read: boolean) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning']) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (r: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(read ? (h.readQueue.shift() ?? []) : []);
  };
  return c;
}

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(() => makeChain(true)),
    update: vi.fn(() => makeChain(false)),
    insert: vi.fn(() => makeChain(false)),
  },
}));

vi.mock('@/db/schema/calendar-schema', () => ({
  externalCalendarConnections: new Proxy({}, { get: (_t, p) => String(p) }),
  calendars: new Proxy({}, { get: (_t, p) => String(p) }),
  calendarEvents: new Proxy({}, { get: (_t, p) => String(p) }),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
}));

vi.mock('./token-crypto', () => ({
  decryptCalendarToken: vi.fn((t: string) => (t ? `dec-${t}` : '')),
  encryptCalendarToken: vi.fn((t: string) => `enc-${t}`),
}));

const graphApi = {
  select: vi.fn(() => graphApi),
  top: vi.fn(() => graphApi),
  header: vi.fn(() => graphApi),
  get: vi.fn(() => h.graphGet),
  patch: vi.fn(() => ({ id: 'ms-patched' })),
  post: vi.fn(() => ({ id: 'ms-new' })),
  delete: vi.fn(() => undefined),
};
const graphClient = { api: vi.fn(() => graphApi) };

vi.mock('@microsoft/microsoft-graph-client', () => ({
  Client: {
    init: vi.fn((opts: { authProvider: (cb: (e: unknown, t: string) => void) => void }) => {
      opts.authProvider(() => { h.authProviderCalled = true; });
      return graphClient;
    }),
  },
}));

const fetchMock = vi.fn();

import {
  deleteEventFromMicrosoft,
  exchangeCodeForTokens,
  exportEventToMicrosoft,
  getAuthorizationUrl,
  getDeltaLink,
  importMicrosoftEvents,
  listMicrosoftCalendars,
  refreshAccessToken,
} from '../microsoft-calendar-service';

function tokenResponse(over: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      access_token: 'at', refresh_token: 'rt', expires_in: 3600, ...over,
    }),
    text: vi.fn().mockResolvedValue(''),
  };
}

const futureConn = {
  id: 'c1', provider: 'microsoft', refreshToken: 'enc-rt',
  accessToken: 'enc-at', tokenExpiresAt: new Date(Date.now() + 3_600_000),
  calendarMappings: {},
};

beforeEach(() => {
  h.readQueue = [];
  h.graphGet = { value: [] };
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  graphApi.get.mockClear();
});

describe('auth URL + token exchange', () => {
  it('builds authorization url', async () => {
    const url = await getAuthorizationUrl('user-1');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('state=user-1');
  });

  it('exchanges code for tokens and parses jwt', async () => {
    const payload = Buffer.from(JSON.stringify({ oid: 'oid1', preferred_username: 'u@e.com' })).toString('base64url');
    fetchMock.mockResolvedValue(tokenResponse({ id_token: `h.${payload}.s` }));
    const result = await exchangeCodeForTokens('code-1');
    expect(result.accessToken).toBe('at');
    expect(result.providerAccountId).toBe('oid1');
    expect(result.providerEmail).toBe('u@e.com');
  });
});

describe('refreshAccessToken', () => {
  it('refreshes and persists new token', async () => {
    h.readQueue = [[futureConn]];
    fetchMock.mockResolvedValue(tokenResponse());
    const token = await refreshAccessToken('c1');
    expect(token).toBe('at');
  });

  it('marks connection failed and rethrows when not found', async () => {
    h.readQueue = [[]];
    await expect(refreshAccessToken('c1')).rejects.toThrow(/not found/);
  });
});

describe('listMicrosoftCalendars', () => {
  it('returns calendar list', async () => {
    h.readQueue = [[futureConn]];
    h.graphGet = { value: [{ id: 'cal1', name: 'Work' }] };
    const cals = await listMicrosoftCalendars('c1');
    expect(cals).toEqual([{ id: 'cal1', name: 'Work' }]);
    expect(h.authProviderCalled).toBe(true);
  });
});

describe('importMicrosoftEvents', () => {
  it('imports new, updates existing, handles deleted', async () => {
    const events = [
      { '@removed': true, id: 'gone' },
      {
        id: 'ev-existing', subject: 'Existing', start: { dateTime: '2024-01-01T10:00:00', timeZone: 'UTC' },
        end: { dateTime: '2024-01-01T11:00:00', timeZone: 'UTC' },
      },
      {
        id: 'ev-new', subject: 'New', isCancelled: true,
        recurrence: { pattern: { type: 'weekly', interval: 2, daysOfWeek: ['monday'], dayOfMonth: 5 }, range: { type: 'endDate', endDate: '2024-06-01' } },
        start: { dateTime: '2024-02-01T10:00:00', timeZone: 'UTC' },
        end: { dateTime: '2024-02-01T11:00:00', timeZone: 'UTC' },
        organizer: { emailAddress: { address: 'org@e.com' } },
        location: { displayName: 'Room' }, onlineMeeting: { joinUrl: 'https://join' },
      },
    ];
    h.graphGet = { value: events, '@odata.deltaLink': 'delta-1' };
    h.readQueue = [
      [futureConn], // getAuthenticatedClient
      [{ id: 'localcal', organizationId: 'org1' }], // localCalendar
      [{ id: 'evdb-gone' }], // handleDeletedMicrosoftEvent select
      [{ id: 'evdb-existing' }], // existing select
      [], // new event select -> none
      [futureConn], // updateDeltaLink select
    ];
    const result = await importMicrosoftEvents('c1', 'localcal', 'ms-cal');
    expect(result.deleted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.total).toBe(3);
  });
});

describe('exportEventToMicrosoft', () => {
  it('patches existing external event', async () => {
    h.readQueue = [
      [futureConn], // client
      [{ id: 'local1', title: 'T', externalEventId: 'ext-1', startTime: new Date(), endTime: new Date(), location: 'Room', recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;COUNT=5;BYDAY=MO,TU;BYMONTHDAY=3', meetingUrl: 'https://m' }],
    ];
    const result = await exportEventToMicrosoft('c1', 'local1', 'ms-cal');
    expect(result).toEqual({ id: 'ms-patched' });
  });

  it('posts new external event and stores id', async () => {
    h.readQueue = [
      [futureConn],
      [{ id: 'local2', title: 'T2', startTime: new Date(), endTime: new Date() }],
    ];
    const result = await exportEventToMicrosoft('c1', 'local2', 'ms-cal');
    expect(result).toEqual({ id: 'ms-new' });
  });
});

describe('deleteEventFromMicrosoft', () => {
  it('deletes the event', async () => {
    h.readQueue = [[futureConn]];
    await expect(deleteEventFromMicrosoft('c1', 'ms-cal', 'ev-1')).resolves.toBeUndefined();
    expect(graphApi.delete).toHaveBeenCalled();
  });
});

describe('getDeltaLink', () => {
  it('returns stored delta link or null', () => {
    expect(getDeltaLink({ calendarMappings: { cal1: { deltaLink: 'd1' } } }, 'cal1')).toBe('d1');
    expect(getDeltaLink({}, 'cal1')).toBeNull();
  });
});
