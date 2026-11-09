import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  withSystemContext: vi.fn(),
  // How many system transactions are open right now
  systemDepth: { value: 0 },
  openAtSelect: [] as number[],
  requirePlatformStaffAuthority: vi.fn(),
}));

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    $dynamic: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => {
    m.openAtSelect.push(m.systemDepth.value);
    return makeChain((m.selectQueue.shift() ?? []) as unknown[]);
  }),
};

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);

// The route lists every organization, so its statements run as the system role: the test stands the system transaction in, never a real connection.
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));

vi.mock('@/db/db', () => ({ db: mockDb }));

// DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY: the platform_lead title is a floor; the directory needs the platform-staff mandate.
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: m.requirePlatformStaffAuthority }));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    sql: vi.fn(() => 'sql'),
    ne: vi.fn(() => 'ne'),
    ilike: vi.fn(() => 'ilike'),
    or: vi.fn(() => 'or'),
    eq: vi.fn(() => 'eq'),
    count: vi.fn(() => 0),
  };
});

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../admin/organizations/route');
}

describe('admin/organizations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'platform_lead';
    m.selectQueue = [];
    m.openAtSelect.length = 0;
    m.systemDepth.value = 0;
    m.requirePlatformStaffAuthority.mockImplementation(async (ctx: { userId: string; organizationId: string }) => ({ userId: ctx.userId, organizationId: ctx.organizationId }));
    m.withSystemContext.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => {
      m.systemDepth.value++;
      try {
        return await run(mockDb);
      } finally {
        m.systemDepth.value--;
      }
    });
  });

  it('declares platform authority: an authenticated platform lead, since it lists every organization', async () => {
    await loadRoute();
    expect(declared).toEqual([{ auth: { required: true, minRole: 'platform_lead' } }]);
  });

  it('refuses every role below platform authority, answering before any system transaction is opened or any row read', async () => {
    const { GET } = await loadRoute();
    for (const role of ['member', 'steward', 'officer', 'admin', 'system_admin', 'content_manager']) {
      caller.role = role;
      const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
      expect((response as Response).status, role).toBe(403);
    }
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('requires the platform-staff mandate for the directory read, not the platform_lead title', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);
    await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect(m.requirePlatformStaffAuthority).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', organizationId: 'org_1' }), 'platform.organization_directory.read');
  });

  it('refuses a platform lead without the platform-staff mandate, before any system transaction is opened or any row read', async () => {
    const { ApiError } = await import('@/lib/api/errors');
    m.requirePlatformStaffAuthority.mockRejectedValue(ApiError.forbidden('Acting across organizations needs platform-staff authority; a role title is not enough'));
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect((response as Response).status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('answers 401 without an authenticated user, reading nothing', async () => {
    const { GET } = await loadRoute();
    caller.userId = null;
    const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect((response as Response).status).toBe(401);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('runs one read, of the organizations table only, as the system role in one system transaction', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);
    await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.openAtSelect).toEqual([1]);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  // Issue #1116: platform staff manage tenancy and operational metadata, never tenant content.
  it('GET returns tenancy metadata only: no member counts, no president or administrator names or e-mail addresses', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      {
        id: 'org_1',
        name: 'Local 100',
        slug: 'local-100',
        organizationType: 'local',
        provinceTerritory: 'ON',
        parentId: 'fed_1',
        status: 'active',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-02-03T00:00:00Z'),
        // Fields a mis-built query might carry: they must not reach the caller.
        memberCount: 80,
        activeMemberCount: 70,
      },
    ]);

    const json = (await GET(new NextRequest('http://localhost/api/admin/organizations'))) as any[];
    expect(json).toEqual([
      {
        id: 'org_1',
        number: 'local-100',
        name: 'Local 100',
        organizationType: 'local',
        region: 'ON',
        parentId: 'fed_1',
        status: 'active',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-02-03T00:00:00.000Z',
      },
    ]);
    for (const key of ['memberCount', 'activeCount', 'president', 'contact', 'email']) expect(json[0]).not.toHaveProperty(key);
  });

  it('does not import or query the membership table', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve(__dirname, '../admin/organizations/route.ts'), 'utf8');
    expect(source).not.toContain('organizationMembers');
    expect(source).not.toMatch(/memberCount|activeMemberCount|email/);
  });

  it('GET supports search parameter and still returns response', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);
    const json = await GET(
      new NextRequest('http://localhost/api/admin/organizations?search=local'),
    );
    expect(Array.isArray(json)).toBe(true);
  });

  it('GET reports a missing region, parent and dates as empty or null, and keeps an inactive status', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'org_2', name: 'Local 200', slug: 'local-200', organizationType: 'local', provinceTerritory: null, parentId: null, status: 'inactive', createdAt: null, updatedAt: null },
    ]);

    const json = (await GET(new NextRequest('http://localhost/api/admin/organizations'))) as any[];
    expect(json[0]).toMatchObject({ region: '', parentId: null, createdAt: null, updatedAt: null, status: 'inactive' });
  });
});
