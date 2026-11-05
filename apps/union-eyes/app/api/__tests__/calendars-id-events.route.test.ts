import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const m = vi.hoisted(() => ({
  selects: [] as Array<{ fields: Record<string, unknown> }>,
  results: [] as unknown[][],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  zUUID: z.string().uuid(),
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/db/schema', () => {
  const columns = (...names: string[]) => Object.fromEntries(names.map((name) => [name, name]));
  return {
    calendars: columns('id', 'ownerId', 'isPersonal', 'organizationId'),
    calendarEvents: columns(
      'id', 'calendarId', 'organizationId', 'title', 'description', 'location', 'startTime', 'endTime', 'isAllDay', 'eventType',
      'status', 'organizerId', 'visibility', 'isPrivate', 'meetingUrl', 'meetingPassword', 'attachments', 'metadata', 'createdBy',
    ),
  };
});
vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => 'and'),
  eq: vi.fn(() => 'eq'),
  or: vi.fn(() => 'or'),
  notInArray: vi.fn(() => 'notInArray'),
  count: vi.fn(() => 'count'),
  desc: vi.fn(() => 'desc'),
}));

const chain = (rows: unknown[]) => {
  const c: Record<string, unknown> = {};
  for (const name of ['from', 'where', 'orderBy', 'limit', 'offset']) c[name] = () => c;
  c.then = (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return c;
};
const tx = {
  select: (fields: Record<string, unknown>) => {
    const rows = m.results[m.selects.length] ?? [];
    m.selects.push({ fields });
    return chain(rows);
  },
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_context: unknown, run: (handle: unknown) => Promise<unknown>) => run(tx)),
}));

const CALENDAR = '11111111-1111-4111-8111-111111111111';
const caller = { organizationId: 'org-1', userId: 'user-1', params: { id: CALENDAR }, request: { url: `https://app.example/api/calendars/${CALENDAR}/events` } };
const row = { id: 'e1', calendarId: CALENDAR, title: 'Hearing', location: 'Hall', isAllDay: false, eventType: 'hearing' };
// withApi is replaced above by a function that runs the handler on a context object.
const get = async (ctx: unknown) => {
  const { GET } = await import('../calendars/[id]/events/route');
  return (GET as unknown as (context: unknown) => Promise<unknown>)(ctx);
};

describe('GET /api/calendars/[id]/events', () => {
  beforeEach(() => {
    m.selects.length = 0;
    m.results = [[{ id: CALENDAR, ownerId: 'user-2', isPersonal: false }], [row], [{ total: 1 }]];
  });

  it('returns what the calendar page draws and edits: the calendar, location, type and all-day of each event', async () => {
    const result = (await get(caller)) as { data: unknown[]; pagination: Record<string, number> };

    expect(result.data).toEqual([row]);
    expect(result.pagination).toMatchObject({ page: 1, total: 1 });
    expect(Object.keys(m.selects[1].fields).sort()).toEqual([
      'calendarId', 'description', 'endTime', 'eventType', 'id', 'isAllDay', 'location', 'organizerId', 'startTime', 'status', 'title', 'visibility',
    ]);
  });

  it('never selects the meeting password, link, attachments, metadata or creator of an event', async () => {
    await get(caller);
    for (const hidden of ['meetingPassword', 'meetingUrl', 'attachments', 'metadata', 'createdBy', 'isPrivate']) {
      expect(m.selects[1].fields).not.toHaveProperty(hidden);
    }
  });

  it('does not list the events of another member’s personal calendar', async () => {
    m.results = [[{ id: CALENDAR, ownerId: 'user-2', isPersonal: true }]];
    await expect(get(caller)).rejects.toMatchObject({ status: 404 });
    expect(m.selects).toHaveLength(1);
  });

  it('refuses a calendar identifier that is not a uuid before reading anything', async () => {
    await expect(get({ ...caller, params: { id: 'not-a-uuid' } })).rejects.toMatchObject({ status: 400 });
    expect(m.selects).toHaveLength(0);
  });
});
