import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ votingSessions: { createdAt: 'createdAt', id: 'id' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, desc: vi.fn(() => 'desc'), count: vi.fn(() => 'count'), eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/elections/sessions/route');
}

describe('governance/elections/sessions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(async () => [{ total: 1 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 's1' }]) })) })) })) }));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 's2', title: 'Session' }]) })) });
  });

  it('lists voting sessions', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/governance/elections/sessions?page=1&limit=20') });

    expect(result).toEqual([{ id: 's1' }]);
  });

  it('creates a voting session', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { title: 'Session', type: 'election', meetingType: 'virtual', organizationId: '550e8400-e29b-41d4-a716-446655440000' }, userId: 'u1' });

    expect(result).toEqual({ id: 's2', title: 'Session' });
  });
});