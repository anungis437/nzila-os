import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
  tables: [] as unknown[],
  organizations: { __table: 'organizations' },
  organizationMembers: { __table: 'organization_members' },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ organizations: m.organizations, organizationMembers: m.organizationMembers }));
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
    m.db.select.mockImplementation(() => ({
      from: vi.fn((table: unknown) => {
        m.tables.push(table);
        return { where: vi.fn(async () => [{ totalOrganizations: 7, activeOrganizations: 5 }]) };
      }),
    }));
    m.tables.length = 0;
    m.db.execute.mockResolvedValue([{ db_size: '2147483648' }]);
  });

  it('returns organization counts and database size, and member figures as null without reading any roster (#1118)', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toEqual({
      totalMembers: null,
      activeOrganizations: 5,
      totalOrganizations: 7,
      totalStorage: 2,
      activeToday: null,
    });
    expect(m.tables).toEqual([m.organizations]);
    expect(m.tables).not.toContain(m.organizationMembers);
  });
});