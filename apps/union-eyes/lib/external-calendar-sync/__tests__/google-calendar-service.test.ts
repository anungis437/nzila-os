import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const oauthInstance = {
    generateAuthUrl: vi.fn(() => 'https://auth-url'),
    setCredentials: vi.fn(),
    getToken: vi.fn(async () => ({ tokens: { access_token: 'at', refresh_token: 'rt', expiry_date: Date.now() + 3_600_000 } })),
    refreshAccessToken: vi.fn(async () => ({ credentials: { access_token: 'nat', refresh_token: 'nrt', expiry_date: Date.now() + 3_600_000 } })),
  };
  const state = {
    readQueue: [] as unknown[],
    calItems: [] as unknown[],
    events: [] as unknown[],
    oauthInstance,
    calendarApi: null as unknown as {
      calendarList: { list: ReturnType<typeof vi.fn> };
      events: Record<string, ReturnType<typeof vi.fn>>;
    },
  };
  state.calendarApi = {
    calendarList: { list: vi.fn(async () => ({ data: { items: state.calItems } })) },
    events: {
      list: vi.fn(async () => ({ data: { items: state.events } })),
      insert: vi.fn(async () => ({ data: { id: 'g-new' } })),
      update: vi.fn(async () => ({ data: { id: 'g-upd' } })),
      delete: vi.fn(async () => undefined),
    },
  };
  return state;
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

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') }));

vi.mock('./token-crypto', () => ({
  decryptCalendarToken: vi.fn((t: string) => (t ? `dec-${t}` : '')),
  encryptCalendarToken: vi.fn((t: string) => `enc-${t}`),
}));

const oauthInstance = h.oauthInstance;
const calendarApi = h.calendarApi;
vi.mock('googleapis', () => ({
  google: {
    calendar: vi.fn(() => h.calendarApi),
    auth: { OAuth2: vi.fn(function () { return h.oauthInstance; }) },
  },
  calendar_v3: {},
}));

import {
  deleteEventFromGoogle,
  exchangeCodeForTokens,
  exportEventToGoogle,
  getAuthorizationUrl,
  importGoogleEvents,
  listGoogleCalendars,
  refreshAccessToken,
} from '../google-calendar-service';

const conn = {
  id: 'c1', organizationId: 'org1', provider: 'google', refreshToken: 'enc-rt', accessToken: 'enc-at',
  tokenExpiresAt: new Date(Date.now() + 3_600_000), calendarMappings: [],
};

beforeEach(() => {
  h.readQueue = [];
  h.calItems = [];
  h.events = [];
});

describe('auth helpers', () => {
  it('generates authorization url', () => {
    expect(getAuthorizationUrl('user-1')).toBe('https://auth-url');
  });

  it('exchanges code for tokens', async () => {
    const result = await exchangeCodeForTokens('code-1');
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
  });
});

describe('refreshAccessToken', () => {
  it('refreshes and persists', async () => {
    h.readQueue = [[conn]];
    expect(await refreshAccessToken('c1')).toBe('nat');
  });

  it('marks failed and rethrows when not found', async () => {
    h.readQueue = [[]];
    await expect(refreshAccessToken('c1')).rejects.toThrow(/not found/);
  });
});

describe('listGoogleCalendars', () => {
  it('returns calendar items', async () => {
    h.readQueue = [[conn]];
    h.calItems = [{ id: 'cal1' }];
    expect(await listGoogleCalendars('c1')).toEqual([{ id: 'cal1' }]);
  });
});

describe('importGoogleEvents', () => {
  it('refuses to import into a calendar of another organization', async () => {
    h.events = [{ id: 'ev-x', summary: 'X', status: 'confirmed', start: { date: '2024-02-01' }, end: { date: '2024-02-02' } }];
    h.readQueue = [[conn], [{ id: 'localcal', organizationId: 'org-other' }]];
    await expect(importGoogleEvents('c1', 'localcal', 'g-cal')).rejects.toThrow(/Local calendar not found/);
  });

  it('scopes every event update by the connection organization', async () => {
    const { and, eq } = await import('drizzle-orm');
    vi.mocked(eq).mockClear();
    h.events = [{ id: 'ev-existing', summary: 'E', status: 'confirmed', start: { date: '2024-02-01' }, end: { date: '2024-02-02' } }];
    h.readQueue = [[conn], [{ id: 'localcal', organizationId: 'org1' }], [{ id: 'evdb-existing' }], []];
    await importGoogleEvents('c1', 'localcal', 'g-cal');
    expect(vi.mocked(and)).toHaveBeenCalled();
    expect(vi.mocked(eq).mock.calls.some((c) => c[0] === 'organizationId' && c[1] === 'org1')).toBe(true);
  });
  it('imports new, updates existing, handles cancelled', async () => {
    h.events = [
      { status: 'cancelled', id: 'gone' },
      { id: 'ev-existing', summary: 'E', status: 'confirmed', start: { dateTime: '2024-01-01T10:00:00Z' }, end: { dateTime: '2024-01-01T11:00:00Z' }, creator: { email: 'a@e.com' }, recurrence: ['RRULE:FREQ=WEEKLY'] },
      { id: 'ev-new', summary: 'N', status: 'tentative', start: { date: '2024-02-01' }, end: { date: '2024-02-02' } },
    ];
    h.readQueue = [
      [conn], // authenticated client
      [{ id: 'localcal', organizationId: 'org1' }], // local calendar
      [{ id: 'evdb-gone' }], // handleDeleted select
      [{ id: 'evdb-existing' }], // existing select
      [], // new select -> none
    ];
    const result = await importGoogleEvents('c1', 'localcal', 'g-cal');
    expect(result.deleted).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.imported).toBe(1);
    expect(result.total).toBe(3);
  });
});

describe('importGoogleEvents — paging and failures', () => {
  const ev = (id: string) => ({ id, summary: id, status: 'confirmed', start: { date: '2024-02-01' }, end: { date: '2024-02-02' } });
  const page = (ids: string[], extra: Record<string, unknown> = {}) => ({ data: { items: ids.map(ev), ...extra } });
  const setup = () => { h.readQueue = [[conn], [{ id: 'localcal', organizationId: 'org1' }]]; };

  it('follows every page of the requested window', async () => {
    setup();
    calendarApi.events.list.mockClear();
    calendarApi.events.list
      .mockResolvedValueOnce(page(['a', 'b'], { nextPageToken: 'p2' }))
      .mockResolvedValueOnce(page(['c']));
    const result = await importGoogleEvents('c1', 'localcal', 'g-cal');
    expect(result).toMatchObject({ total: 3, imported: 3, pages: 2 });
    expect(calendarApi.events.list.mock.calls[0][0]).toMatchObject({ maxResults: 250, orderBy: 'startTime' });
    expect(calendarApi.events.list.mock.calls[0][0].pageToken).toBeUndefined();
    expect(calendarApi.events.list.mock.calls[1][0].pageToken).toBe('p2');
  });

  it('lists the window it was given, not an open-ended one', async () => {
    setup();
    calendarApi.events.list.mockClear();
    calendarApi.events.list.mockResolvedValueOnce(page(['a']));
    const timeMin = new Date('2024-03-01T00:00:00Z');
    const timeMax = new Date('2024-04-01T00:00:00Z');
    await importGoogleEvents('c1', 'localcal', 'g-cal', { timeMin, timeMax });
    expect(calendarApi.events.list.mock.calls[0][0]).toMatchObject({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });
  });

  it('does not report success when an event could not be applied', async () => {
    setup();
    const { db } = await import('@/db/db');
    vi.mocked(db.insert).mockImplementationOnce(() => { throw new Error('insert refused'); });
    calendarApi.events.list.mockResolvedValueOnce(page(['a', 'b']));
    await expect(importGoogleEvents('c1', 'localcal', 'g-cal')).rejects.toMatchObject({
      name: 'CalendarImportError', detail: { failed: 1, incomplete: false },
    });
  });

  it('fails an import that would run past the page bound instead of reporting it complete', async () => {
    setup();
    calendarApi.events.list.mockImplementation(async () => page(['x'], { nextPageToken: 'more' }));
    try {
      await expect(importGoogleEvents('c1', 'localcal', 'g-cal')).rejects.toMatchObject({ detail: { incomplete: true, pages: 50 } });
    } finally {
      calendarApi.events.list.mockImplementation(async () => ({ data: { items: h.events } }));
    }
  });
});

describe('exportEventToGoogle', () => {
  it('refuses to export an event of another organization', async () => {
    calendarApi.events.insert.mockClear();
    h.readQueue = [[conn], [{ id: 'l9', organizationId: 'org-other', title: 'T', isAllDay: true, startTime: new Date(), endTime: new Date() }]];
    await expect(exportEventToGoogle('c1', 'l9', 'g-cal')).rejects.toThrow(/Local event not found/);
    expect(calendarApi.events.insert).not.toHaveBeenCalled();
  });
  it('updates existing external event', async () => {
    h.readQueue = [
      [conn],
      [{ id: 'l1', organizationId: 'org1', title: 'T', description: 'd', location: 'loc', isAllDay: false, timezone: 'UTC', startTime: new Date(), endTime: new Date(), externalEventId: 'ext-1', recurrenceRule: 'RRULE:FREQ=DAILY', meetingUrl: 'https://m' }],
    ];
    expect(await exportEventToGoogle('c1', 'l1', 'g-cal')).toEqual({ id: 'g-upd' });
  });

  it('inserts new external event', async () => {
    h.readQueue = [
      [conn],
      [{ id: 'l2', organizationId: 'org1', title: 'T2', isAllDay: true, startTime: new Date(), endTime: new Date() }],
    ];
    expect(await exportEventToGoogle('c1', 'l2', 'g-cal')).toEqual({ id: 'g-new' });
  });
});

describe('deleteEventFromGoogle', () => {
  it('deletes the event', async () => {
    h.readQueue = [[conn]];
    await expect(deleteEventFromGoogle('c1', 'g-cal', 'ev-1')).resolves.toBeUndefined();
    expect(calendarApi.events.delete).toHaveBeenCalled();
  });
});
