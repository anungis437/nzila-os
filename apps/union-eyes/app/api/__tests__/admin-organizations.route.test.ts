import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  withSystemContext: vi.fn(),
  // How many system transactions are open right now
  systemDepth: { value: 0 },
  openAtSelect: [] as number[],
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

  it('answers 401 without an authenticated user, reading nothing', async () => {
    const { GET } = await loadRoute();
    caller.userId = null;
    const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect((response as Response).status).toBe(401);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('runs all three reads as the system role, in one system transaction', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([], [], []);
    await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.openAtSelect).toEqual([1, 1, 1]);
  });

  it('GET returns mapped organizations with live counts and contacts', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [
        {
          id: 'org_1',
          name: 'Local 100',
          slug: 'local-100',
          organizationType: 'local',
          provinceTerritory: 'ON',
          memberCount: 80,
          activeMemberCount: 70,
          status: 'active',
        },
      ],
      [{ organizationId: 'org_1', total: 120, active: 110 }],
      [{ organizationId: 'org_1', name: 'Alex President', email: 'alex@example.com', role: 'president' }],
    );

    const json = (await GET(new NextRequest('http://localhost/api/admin/organizations'))) as any[];
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: 'org_1',
      name: 'Local 100',
      memberCount: 120,
      activeCount: 110,
      president: 'Alex President',
      contact: 'alex@example.com',
    });
  });

  it('GET supports search parameter and still returns response', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([], [], []);
    const json = await GET(
      new NextRequest('http://localhost/api/admin/organizations?search=local'),
    );
    expect(Array.isArray(json)).toBe(true);
  });

  it('GET falls back to table counts when live counts missing', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [
        {
          id: 'org_2',
          name: 'Local 200',
          slug: 'local-200',
          organizationType: 'local',
          provinceTerritory: null,
          memberCount: 45,
          activeMemberCount: 40,
          status: 'inactive',
        },
      ],
      [],
      [],
    );

    const json = (await GET(new NextRequest('http://localhost/api/admin/organizations'))) as any[];
    expect(json[0]).toMatchObject({
      memberCount: 45,
      activeCount: 40,
      region: '',
      status: 'inactive',
    });
  });

  it('GET keeps first contact when multiple contacts exist', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [
        {
          id: 'org_1',
          name: 'Local 100',
          slug: 'local-100',
          organizationType: 'local',
          provinceTerritory: 'ON',
          memberCount: 80,
          activeMemberCount: 70,
          status: 'active',
        },
      ],
      [{ organizationId: 'org_1', total: 80, active: 70 }],
      [
        { organizationId: 'org_1', name: 'First Contact', email: 'first@example.com', role: 'president' },
        { organizationId: 'org_1', name: 'Second Contact', email: 'second@example.com', role: 'admin' },
      ],
    );

    const json = (await GET(new NextRequest('http://localhost/api/admin/organizations'))) as any[];
    expect(json[0].president).toBe('First Contact');
    expect(json[0].contact).toBe('first@example.com');
  });
});
