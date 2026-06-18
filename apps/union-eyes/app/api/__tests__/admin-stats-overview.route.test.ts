import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ organizations: {}, organizationMembers: {} }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    count: vi.fn(() => 'count'),
    ne: vi.fn(() => 'ne'),
    sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }),
  };
});

async function loadRoute() {
  return import('../admin/stats/overview/route');
}

describe('admin/stats/overview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<unknown>) =>
      () => handler());
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(async () => [{ totalMembers: 42 }]) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ totalOrganizations: 7, activeOrganizations: 5 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ activeToday: 11 }]) })) }));
    m.db.execute.mockResolvedValue([{ db_size: '2147483648' }]);
  });

  it('returns system overview metrics', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toMatchObject({
      totalMembers: 42,
      activeOrganizations: 5,
      totalOrganizations: 7,
      totalStorage: 2,
      activeToday: 11,
    });
  });
});