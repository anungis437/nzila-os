import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  requireUserForOrganization: vi.fn(),
  selectQueue: [] as unknown[][],
  executeQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(async () => rows),
  };
  return chain;
}

function makeUpdateChain(rows: unknown[]) {
  const chain: any = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
  update: vi.fn(() => makeUpdateChain((m.updateQueue.shift() ?? []) as unknown[])),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/api-auth-guard', () => ({
  requireUserForOrganization: m.requireUserForOrganization,
  ROLE_HIERARCHY: { member: 1, steward: 2, admin: 3, owner: 4 },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: vi.fn((strs: any, ...vals: any[]) => ({ strs, vals })) };
});

async function loadRoute() {
  return import('../organizations/[id]/route');
}

const orgRow = {
  id: 'org_1', name: 'Org', slug: 'org', displayName: 'Org', shortName: 'Org', organizationType: 'local',
  parentId: null, hierarchyPath: [], hierarchyLevel: 0, provinceTerritory: null, sectors: [], email: null, phone: null,
  website: null, address: null, clcAffiliated: false, affiliationDate: null, charterNumber: null, memberCount: 3,
  activeMemberCount: 2, lastMemberCountUpdate: null, subscriptionTier: 'starter', billingContactId: null,
  settings: {}, featuresEnabled: [], status: 'active', createdAt: new Date(), updatedAt: new Date(), createdBy: null,
  legacyOrgId: null,
};

describe('organizations/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.executeQueue = [];
    m.updateQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.requireUserForOrganization.mockResolvedValue({ roles: ['admin'] });
  });

  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new NextRequest('http://localhost/api/organizations/org_1'), { params: Promise.resolve({ id: 'org_1' }) });
    expect(response.status).toBe(401);
  });

  it('GET returns 404 when org not found', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new NextRequest('http://localhost/api/organizations/org_1'), { params: Promise.resolve({ id: 'org_1' }) });
    expect(response.status).toBe(404);
  });

  it('GET returns mapped organization and stats', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([orgRow]);
    m.executeQueue.push([{ total: 5, active: 2 }], [{ cnt: 1 }]);

    const response = await GET(new NextRequest('http://localhost/api/organizations/org_1'), { params: Promise.resolve({ id: 'org_1' }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.id).toBe('org_1');
    expect(json.data.totalClaims).toBe(5);
  });

  it('PATCH returns 403 when org auth check fails', async () => {
    const { PATCH } = await loadRoute();
    m.requireUserForOrganization.mockRejectedValueOnce(new Error('forbidden'));

    const response = await PATCH(new NextRequest('http://localhost/api/organizations/org_1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'New' }),
    }), { params: Promise.resolve({ id: 'org_1' }) });

    expect(response.status).toBe(403);
  });

  it('PATCH updates organization and returns payload', async () => {
    const { PATCH } = await loadRoute();
    m.updateQueue.push([{ ...orgRow, name: 'New' }]);

    const response = await PATCH(new NextRequest('http://localhost/api/organizations/org_1', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'New' }),
    }), { params: Promise.resolve({ id: 'org_1' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.name).toBe('New');
  });

  it('DELETE archives organization', async () => {
    const { DELETE } = await loadRoute();
    m.updateQueue.push([{ ...orgRow, status: 'archived' }]);

    const response = await DELETE(new NextRequest('http://localhost/api/organizations/org_1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'org_1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.status).toBe('archived');
  });
});
