import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The organization read authority is exercised in organizations-read-authority.pglite.test.ts; these tests exercise the
// route's own behaviour for a caller who is a direct member of org_1 (reads) or only affiliated with it.
const authority = vi.hoisted(() => ({ reads: true }));
vi.mock('@/lib/organizations/read-authority', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/organizations/read-authority')>()),
  resolveOrganizationAccess: async () => ({ direct: new Map([['org_1', 'member']]), affiliated: new Set() }),
  affiliationOrganizationIds: () => ['org_1'],
  canReadOrganization: () => authority.reads,
}));
vi.mock('@/lib/api-auth-guard', () => ({ ROLE_HIERARCHY: { member: 1, steward: 2, admin: 3 } }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }));
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', organizationType: 'organizationType', hierarchyLevel: 'hierarchyLevel', name: 'name' }, organizationMembers: {} }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, ne: vi.fn(() => 'ne'), asc: vi.fn(() => 'asc') };
});

async function loadRoute() {
  return import('../organizations/hierarchy/route');
}

describe('organizations/hierarchy route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authority.reads = true;
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'org_1', name: 'Union', organizationType: 'union', hierarchyLevel: 1, hierarchyPath: ['root'], parentId: 'root', memberCount: 5, activeMemberCount: 4, status: 'active', sectors: [], clcAffiliated: true }]) })) })) })) } as any);
  });

  it('returns the organization hierarchy', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/organizations/hierarchy'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]).toMatchObject({ id: 'org_1', member_count: 5, active_member_count: 4 });
  });

  it('gives an organization the caller is only affiliated with as its directory entry, without member counts', async () => {
    const { GET } = await loadRoute();
    authority.reads = false;
    const [row] = (await (await GET(new NextRequest('http://localhost/api/organizations/hierarchy'))).json()).data;
    expect(row).toMatchObject({ id: 'org_1', name: 'Union', organization_type: 'union', parent_id: 'root' });
    for (const key of ['member_count', 'active_member_count', 'sectors', 'clc_affiliated']) expect(row, key).not.toHaveProperty(key);
  });
});