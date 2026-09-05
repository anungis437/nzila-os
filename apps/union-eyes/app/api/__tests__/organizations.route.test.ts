import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  requireSystemAdmin: vi.fn(),
  withRLSContext: vi.fn(),
  withSystemContext: vi.fn(),
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

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth, requireSystemAdmin: m.requireSystemAdmin }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/db/schema', () => ({ organizations: { id: 'id', parentId: 'parentId', status: 'status', hierarchyPath: 'hierarchyPath', hierarchyLevel: 'hierarchyLevel' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext, withSystemContext: m.withSystemContext }));
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
    m.requireSystemAdmin.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.withSystemContext.mockImplementation(async (fn: (tx?: unknown) => unknown) => fn({}));
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

  it('POST returns 403 when the authenticated user is not a system administrator', async () => {
    const { POST } = await loadRoute();
    m.requireSystemAdmin.mockRejectedValueOnce(new Error('System administrator privileges required'));

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Org', slug: 'org', type: 'local' }),
    }));

    expect(response.status).toBe(403);
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

  it('POST returns 400 for an invalid organization type', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Org', slug: 'org', organization_type: 'not-a-real-type' }),
    }));

    expect(response.status).toBe(400);
  });

  it('POST returns 400 when the requested parent organization does not exist', async () => {
    const { POST } = await loadRoute();
    m.rowsQueue.push([]); // parent lookup finds nothing

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Org', slug: 'org', type: 'local', parent_id: 'missing-parent' }),
    }));

    expect(response.status).toBe(400);
  });

  it('POST derives hierarchyPath/hierarchyLevel from the parent and persists the requested type', async () => {
    const { POST } = await loadRoute();
    m.rowsQueue.push([{ hierarchyPath: ['root-id'], hierarchyLevel: 1 }]); // parent lookup

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      // Mirrors the actual New Organization page payload shape (type + parent_id).
      body: JSON.stringify({ name: 'Local 456', slug: 'local-456', type: 'local', parent_id: 'parent-id' }),
    }));

    expect(response.status).toBe(201);
    const insertedValues = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.organizationType).toBe('local');
    expect(insertedValues.parentId).toBe('parent-id');
    expect(insertedValues.hierarchyPath).toEqual(['root-id', 'parent-id']);
    expect(insertedValues.hierarchyLevel).toBe(2);
  });

  it('POST returns 400 when the parent is already at maximum hierarchy depth', async () => {
    const { POST } = await loadRoute();
    // Parent's own hierarchyPath is already 10 ancestors deep (MAX_HIERARCHY_DEPTH).
    const deepPath = Array.from({ length: 10 }, (_, i) => `ancestor-${i}`);
    m.rowsQueue.push([{ hierarchyPath: deepPath, hierarchyLevel: 10 }]);

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Too Deep', slug: 'too-deep', type: 'local', parent_id: 'parent-id' }),
    }));

    expect(response.status).toBe(400);
  });

  it('POST accepts the organizationType/parentOrganizationId field-name convention used by OrganizationHierarchyAdmin', async () => {
    const { POST } = await loadRoute();
    m.rowsQueue.push([{ hierarchyPath: [], hierarchyLevel: 0 }]); // parent lookup

    const response = await POST(new NextRequest('http://localhost/api/organizations', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Region A', organizationType: 'region', parentOrganizationId: 'parent-id' }),
    }));

    expect(response.status).toBe(201);
    const insertedValues = mockDb.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.organizationType).toBe('region');
    expect(insertedValues.hierarchyLevel).toBe(1);
  });
});
