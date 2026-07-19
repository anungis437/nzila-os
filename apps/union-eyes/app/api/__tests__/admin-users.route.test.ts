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
  return {
    ...actual,
    desc: vi.fn(() => 'desc'),
    eq: vi.fn(() => 'eq'),
    or: vi.fn(() => 'or'),
    ilike: vi.fn(() => 'ilike'),
    sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }),
  };
});

async function loadRoute() {
  return import('../admin/users/route');
}

describe('admin/users route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            $dynamic: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{ id: 'u1', name: 'Ada', email: 'ada@example.com', organizationName: 'Union', status: 'active', role: 'admin', joinedAt: '2026-01-01', createdAt: '2026-01-01', organizationId: 'org_1' }]),
              })),
              limit: vi.fn(async () => [{ id: 'u1', name: 'Ada', email: 'ada@example.com', organizationName: 'Union', status: 'active', role: 'admin', joinedAt: '2026-01-01', createdAt: '2026-01-01', organizationId: 'org_1' }]),
            })),
          })),
        })),
      })),
    } as any);
  });

  it('returns the user list', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/admin/users?search=Ada') });

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      organizationName: 'Union',
      status: 'active',
    });
  });
});