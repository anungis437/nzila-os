import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rows: [] as Array<{ id: string }>,
  contexts: [] as Array<{ organizationId: string; userId: string }>,
  limits: [] as number[],
  offsets: [] as number[],
  predicates: [] as Array<{ a: unknown; b: unknown }>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: unknown) => handler,
  ApiError: { forbidden: (message: string) => new Error(message) },
}));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ POST: vi.fn() }) }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({
  calendarEvents: Object.fromEntries(
    ['id', 'calendarId', 'organizationId', 'title', 'description', 'location', 'startTime',
      'endTime', 'status', 'eventType', 'organizerId', 'isPrivate', 'visibility'].map((key) => [key, 'event.' + key]),
  ),
  calendars: Object.fromEntries(
    ['id', 'organizationId', 'isPersonal', 'ownerId'].map((key) => [key, 'calendar.' + key]),
  ),
}));
vi.mock('drizzle-orm', () => ({
  eq: (a: unknown, b: unknown) => { m.predicates.push({ a, b }); return { eq: [a, b] }; },
  and: (...conditions: unknown[]) => ({ and: conditions }),
  or: (...conditions: unknown[]) => ({ or: conditions }),
  notInArray: (a: unknown, b: unknown) => ({ notInArray: [a, b] }),
  desc: (column: unknown) => ({ desc: column }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: { organizationId: string; userId: string }, callback: (tx: unknown) => Promise<unknown>) => {
    m.contexts.push(context);
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: (n: number) => { m.limits.push(n); return chain; },
      offset: async (n: number) => { m.offsets.push(n); return m.rows; },
    };
    return callback({ select: () => chain });
  },
}));

const context = (url: string, organizationId: string | null = 'org-a', userId: string | null = 'user-a') => ({
  request: { url }, organizationId, userId,
});

describe('calendar event listing: authorized pagination', () => {
  beforeEach(() => {
    m.rows = [];
    m.contexts.length = 0;
    m.limits.length = 0;
    m.offsets.length = 0;
    m.predicates.length = 0;
  });

  it('returns a full first page and an explicit continuation instead of hiding event 101', async () => {
    const { GET } = await import('../route');
    m.rows = Array.from({ length: 101 }, (_, i) => ({ id: String(i + 1) }));
    const response = await (GET as any)(context('https://ue.example/api/calendar/events'));
    expect(response.data).toHaveLength(100);
    expect(response.data[0].id).toBe('1');
    expect(response.data[99].id).toBe('100');
    expect(response).toMatchObject({ limit: 100, offset: 0, hasMore: true });
    expect(m.limits).toEqual([101]);
    expect(m.offsets).toEqual([0]);
  });

  it('supports bounded later pages while preserving the authenticated tenant context', async () => {
    const { GET } = await import('../route');
    m.rows = [{ id: '101' }];
    const response = await (GET as any)(context('https://ue.example/api/calendar/events?limit=10&offset=100'));
    expect(response).toMatchObject({ data: [{ id: '101' }], limit: 10, offset: 100, hasMore: false });
    expect(m.limits).toEqual([11]);
    expect(m.offsets).toEqual([100]);
    expect(m.contexts).toEqual([{ organizationId: 'org-a', userId: 'user-a' }]);
    expect(m.predicates.filter((p) => p.b === 'org-a').map((p) => p.a))
      .toEqual(expect.arrayContaining(['event.organizationId', 'calendar.organizationId']));
    expect(m.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ a: 'calendar.ownerId', b: 'user-a' }),
      expect.objectContaining({ a: 'event.organizerId', b: 'user-a' }),
    ]));
  });

  it('bounds malformed pagination and refuses missing identity before querying', async () => {
    const { GET } = await import('../route');
    const page = await (GET as any)(context('https://ue.example/api/calendar/events?limit=100000&offset=-10'));
    expect(page).toMatchObject({ limit: 100, offset: 0 });
    expect(m.limits).toEqual([101]);
    m.limits.length = 0;
    await expect((GET as any)(context('https://ue.example/api/calendar/events', null))).rejects.toThrow('Calendar identity required');
    expect(m.limits).toEqual([]);
  });
});
