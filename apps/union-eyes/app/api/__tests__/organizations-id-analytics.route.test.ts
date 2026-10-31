import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The organization read authority is proven in organizations-read-authority.route.test.ts; these tests exercise the
// route's own behaviour as a caller who may read and administer the organization.
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: async () => ({ platform: true, direct: new Map(), descendants: new Set() }),
  canReadOrganization: () => true,
  canAdministerOrganization: () => true,
  readableOrganizationIds: () => null,
  directRoleIn: () => 'admin',
  UUID_PATTERN: /^[0-9a-fA-F-]{36}$/,
}));
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
  withRLSContext: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', name: 'name', organizationType: 'organizationType' } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
  withSystemContext: async (fn: () => Promise<unknown>) => fn(),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../organizations/[id]/analytics/route');
}

describe('organizations/[id]/analytics route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.withRLSContext.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.db));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Union', organizationType: 'union' }]) })) } as any);
    m.db.execute
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ total: 30, active: 20, new_this_month: 10, prev: 20 }])
      .mockResolvedValueOnce([{ total: 20, active: 10, resolved: 10, this_month: 6 }])
      .mockResolvedValueOnce([{ avg_days: 7 }])
      .mockResolvedValueOnce([{ status: 'open', cnt: 10 }, { status: 'closed', cnt: 10 }]);
  });

  it('returns analytics for an organization', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/organizations/11111111-1111-4111-8111-111111111111/analytics'), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      organizationId: '11111111-1111-4111-8111-111111111111',
      organizationName: 'Union',
      totalMembers: 30,
      activeMembers: 20,
      totalClaims: 20,
      avgResolutionDays: 7,
      childOrganizations: 2,
      memberGrowthRate: 50,
      suppression: { minimumGroupSize: 5, members: false, claims: false },
    });
  });
  it('suppresses the entire member and claim families when small cells could be inferred', async () => {
    m.db.execute.mockReset();
    m.db.execute
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ total: 10, active: 8, new_this_month: 2, prev: 8 }])
      .mockResolvedValueOnce([{ total: 5, active: 3, resolved: 2, this_month: 1 }])
      .mockResolvedValueOnce([{ avg_days: 7 }])
      .mockResolvedValueOnce([{ status: 'open', cnt: 3 }, { status: 'closed', cnt: 2 }]);

    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/organizations/11111111-1111-4111-8111-111111111111/analytics'), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) });
    const { data } = await response.json();

    expect(response.status).toBe(200);
    expect(data.suppression).toEqual({ minimumGroupSize: 5, members: true, claims: true });
    for (const field of [
      'totalMembers', 'activeMembers', 'newMembersThisMonth', 'memberGrowthRate',
      'totalClaims', 'activeClaims', 'resolvedClaims', 'claimsThisMonth', 'avgResolutionDays', 'claimsByStatus',
    ]) {
      expect(data[field]).toBeNull();
    }
    expect(data.childOrganizations).toBe(2);
  });
});
