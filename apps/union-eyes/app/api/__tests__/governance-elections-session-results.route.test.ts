import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ votingSessions: { id: 'id' }, votingOptions: { sessionId: 'sessionId', id: 'id', text: 'text' }, votes: { sessionId: 'sessionId', optionId: 'optionId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/elections/sessions/[id]/results/route');
}

describe('governance/elections/sessions/[id]/results route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 's1', title: 'Session' }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'o1', text: 'Option 1' }, { id: 'o2', text: 'Option 2' }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ groupBy: vi.fn(async () => [{ optionId: 'o1', count: 3 }, { optionId: 'o2', count: 1 }]) })) })) }));
  });

  it('returns aggregated election results', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: { url: 'http://localhost/api/governance/elections/sessions/s1/results' } });

    expect(result.totalVotes).toBe(4);
    expect(result.results).toEqual([
      { optionId: 'o1', label: 'Option 1', votes: 3, percentage: 75 },
      { optionId: 'o2', label: 'Option 2', votes: 1, percentage: 25 },
    ]);
  });
});