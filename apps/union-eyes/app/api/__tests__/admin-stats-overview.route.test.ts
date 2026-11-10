import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
  tables: [] as unknown[],
  organizations: { __table: 'organizations' },
  organizationMembers: { __table: 'organization_members' },
  requirePlatformStaffAuthority: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.requirePlatformStaffAuthority }));
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
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) =>
      () => handler({ userId: 'u1', organizationId: 'org_1' }));
    m.requirePlatformStaffAuthority.mockResolvedValue({ userId: 'u1', organizationId: 'org_1' });
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

  // DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY: the platform_lead title is only a floor.
  it('requires the platform-staff mandate before any statement runs', async () => {
    const { GET } = await loadRoute();
    await GET();
    expect(m.requirePlatformStaffAuthority).toHaveBeenCalledWith({ userId: 'u1', organizationId: 'org_1' }, 'platform.stats.read');
  });

  it('refuses a platform lead without the platform-staff mandate, opening no system transaction and reading nothing', async () => {
    m.requirePlatformStaffAuthority.mockRejectedValue(Object.assign(new Error('Acting across organizations needs platform-staff authority'), { status: 403 }));
    const { GET } = await loadRoute();
    await expect(GET()).rejects.toThrow('platform-staff authority');
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.db.execute).not.toHaveBeenCalled();
  });
});
