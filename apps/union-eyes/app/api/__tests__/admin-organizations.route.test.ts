import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  selectQueue: [] as unknown[][],
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
  select: vi.fn(() => makeChain((m.selectQueue.shift() ?? []) as unknown[])),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));

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

async function loadRoute() {
  return import('../admin/organizations/route');
}

describe('admin/organizations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = {}) => {
          const data = await handler({ request, ...ctx });
          return new Response(JSON.stringify(data), { status: 200 });
        },
    );
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

    const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    expect(response.status).toBe(200);
    const json = await response.json();
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
    const response = await GET(
      new NextRequest('http://localhost/api/admin/organizations?search=local'),
    );
    expect(response.status).toBe(200);
    const json = await response.json();
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

    const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    const json = await response.json();
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

    const response = await GET(new NextRequest('http://localhost/api/admin/organizations'));
    const json = await response.json();
    expect(json[0].president).toBe('First Contact');
    expect(json[0].contact).toBe('first@example.com');
  });
});
