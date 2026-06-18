import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ organizationMembers: {}, organizations: {} }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, desc: vi.fn(() => 'desc'), eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/stats/activity/route');
}

describe('admin/stats/activity route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => [
              { id: 'u1', name: 'Ada', email: 'ada@example.com', role: 'admin', orgName: 'Union', createdAt: '2026-01-01' },
            ]),
          })),
        })),
      })),
    } as any);
  });

  it('returns recent member activity', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/admin/stats/activity?limit=10') });

    expect(result).toEqual([
      {
        id: 'u1',
        type: 'member_added',
        description: 'Ada joined Union as admin',
        user: 'Ada',
        email: 'ada@example.com',
        organizationName: 'Union',
        timestamp: '2026-01-01',
      },
    ]);
  });
});