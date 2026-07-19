import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  withRLSContext: vi.fn(),
  rowsQueue: [] as unknown[][],
  executeQueue: [] as unknown[][],
  inserted: null as any,
}));

const mockDb: any = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => (m.rowsQueue.shift() ?? []) as unknown[]),
    })),
  })),
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [m.inserted]),
    })),
  })),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/db/schema', () => ({ organizations: { id: 'id', parentId: 'parentId', status: 'status' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  const sqlMock: any = vi.fn((s: any, ...v: any[]) => ({ s, v }));
  sqlMock.join = vi.fn(() => 'join');
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: sqlMock };
});

async function loadRoute() {
  return import('../organizations/route');
}

const orgRow = {
  id: 'org_1', name: 'Org', slug: 'org', displayName: 'Org', shortName: 'Org', organizationType: 'local',
  parentId: null, hierarchyPath: [], hierarchyLevel: 0, provinceTerritory: null, sectors: [], email: null,
  phone: null, website: null, address: null, clcAffiliated: false, affiliationDate: null, charterNumber: null,
  memberCount: 2, activeMemberCount: 1, lastMemberCountUpdate: null, subscriptionTier: 'starter', billingContactId: null,
  settings: {}, featuresEnabled: [], status: 'active', createdAt: new Date(), updatedAt: new Date(), createdBy: null, legacyOrgId: null,
};

describe('organizations route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rowsQueue = [];
    m.executeQueue = [];
    m.inserted = { ...orgRow };
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new NextRequest('http://localhost/api/organizations'));
    expect(response.status).toBe(401);
  });

  it('GET returns organizations with include_stats enrichment', async () => {
    const { GET } = await loadRoute();
    m.rowsQueue.push([orgRow]);
    m.executeQueue.push([{ org_id: 'org_1', cnt: 3 }], [{ parent: 'org_1', cnt: 1 }]);

    const response = await GET(new NextRequest('http://localhost/api/organizations?include_stats=true'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data[0].activeClaims).toBe(3);
    expect(json.data[0].childCount).toBe(1);
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Org' }),
    }));
    expect(response.status).toBe(401);
  });

  it('POST creates organization and returns 201', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Org', slug: 'org', organization_type: 'local', display_name: 'Org' }),
    }));

    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).toBe('org_1');
  });
});
