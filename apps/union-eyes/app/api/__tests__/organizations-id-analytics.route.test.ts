import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
  withRLSContext: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', name: 'name', organizationType: 'organizationType' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
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
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'org_1', name: 'Union', organizationType: 'union' }]) })) } as any);
    m.db.execute
      .mockResolvedValueOnce([{ total: 10, active: 8, new_this_month: 2 }])
      .mockResolvedValueOnce([{ total: 5, active: 3, resolved: 2, this_month: 1 }])
      .mockResolvedValueOnce([{ avg_days: 7 }])
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ prev: 6, total: 10 }])
      .mockResolvedValueOnce([{ status: 'open', cnt: 4 }, { status: 'closed', cnt: 2 }]);
  });

  it('returns analytics for an organization', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/organizations/org_1/analytics'), { params: Promise.resolve({ id: 'org_1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      organizationId: 'org_1',
      organizationName: 'Union',
      totalMembers: 10,
      activeMembers: 8,
      totalClaims: 5,
      avgResolutionDays: 7,
      childOrganizations: 2,
      memberGrowthRate: expect.any(Number),
    });
  });
});