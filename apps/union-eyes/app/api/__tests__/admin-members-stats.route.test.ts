import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  hasMinRole: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn() },
  resolveOrganizationAccess: vi.fn(),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api-auth-guard')>('@/lib/api-auth-guard')),
  hasMinRole: m.hasMinRole,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/organizations/read-authority', async () => {
  const actual = await vi.importActual<typeof import('@/lib/organizations/read-authority')>('@/lib/organizations/read-authority');
  return { ...actual, resolveOrganizationAccess: m.resolveOrganizationAccess };
});
vi.mock('@/db/schema', () => ({ organizationMembers: { organizationId: 'organizationId', deletedAt: 'deletedAt', status: 'status', role: 'role' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), isNull: vi.fn(() => 'isNull'), inArray: vi.fn(() => 'inArray'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/members/stats/route');
}

describe('admin/members/stats route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: () => Promise<unknown>) => fn());
    m.resolveOrganizationAccess.mockResolvedValue({ direct: new Map([[ORG, 'admin'], [OTHER_ORG, 'steward']]) });
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 10 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 8 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 3 }]) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 2 }]) })) }));
  });

  it('returns the member counts of an organization the caller administers through a direct membership, under that organization\'s RLS context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest(`http://localhost/api/admin/members/stats?organizationId=${ORG}`));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.total).toBe(10);
    expect(json.active).toBe(8);
    expect(json.stewards).toBe(3);
    expect(json.officers).toBe(2);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG, userId: 'u1' }, expect.any(Function));
  });

  // DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY: the platform_lead title is not authority over any organization's roster.
  it('refuses counts across every organization (no organizationId) to a platform title, reading nothing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/members/stats'));

    expect(response.status).toBe(403);
    expect(m.resolveOrganizationAccess).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('answers 404 for an organization the caller does not administer directly (a steward there, or no membership), reading nothing', async () => {
    const { GET } = await loadRoute();
    for (const organizationId of [OTHER_ORG, '33333333-3333-4333-8333-333333333333']) {
      const response = await GET(new NextRequest(`http://localhost/api/admin/members/stats?organizationId=${organizationId}`));
      expect(response.status).toBe(404);
    }
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('rejects an organizationId that is not an organization id', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/members/stats?organizationId=org_1'));
    expect(response.status).toBe(400);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('refuses a caller below the platform_lead floor before resolving any access', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest(`http://localhost/api/admin/members/stats?organizationId=${ORG}`));
    expect(response.status).toBe(403);
    expect(m.resolveOrganizationAccess).not.toHaveBeenCalled();
  });
});