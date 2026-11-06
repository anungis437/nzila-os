import { beforeEach, describe, expect, it, vi } from 'vitest';
import { organizationMembers, organizations } from '@/db/schema-organizations';

const m = vi.hoisted(() => ({
  isPlatformAdminUser: vi.fn(),
  withSystemContext: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  isPlatformAdminUser: m.isPlatformAdminUser,
  ROLE_HIERARCHY: { member: 1, steward: 2, officer: 3, admin: 4, platform_lead: 5 },
}));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));

const orgA = '11111111-1111-4111-8111-111111111111';
const orgChild = '22222222-2222-4222-8222-222222222222';
const foreignOrg = '33333333-3333-4333-8333-333333333333';

function systemTransaction(memberships: Array<{ organizationId: string; role: string }>, descendants: Array<{ id: string }>) {
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() =>
          table === organizationMembers
            ? Promise.resolve(memberships)
            : { limit: vi.fn().mockResolvedValue(descendants) },
        ),
      })),
    })),
  };
  return tx;
}

describe('organization read authority uses the explicit system transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.isPlatformAdminUser.mockResolvedValue(false);
  });

  it('uses transaction-bound membership and hierarchy queries, never a bare database handle', async () => {
    const tx = systemTransaction([{ organizationId: orgA, role: 'admin' }], [{ id: orgChild }]);
    m.withSystemContext.mockImplementation(async (callback: (systemTx: typeof tx) => unknown) => callback(tx));
    const { resolveOrganizationAccess, canReadOrganization, canAdministerOrganization, canSeeAffiliation, readableOrganizationIds, affiliationOrganizationIds } =
      await import('../read-authority');
    const access = await resolveOrganizationAccess('user-a');
    expect(m.withSystemContext).toHaveBeenCalledTimes(2);
    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(canReadOrganization(access, orgA)).toBe(true);
    expect(canAdministerOrganization(access, orgA)).toBe(true);
    // Issue #1116: the organization below is affiliated, not readable or administrable.
    expect(canSeeAffiliation(access, orgChild)).toBe(true);
    expect(canReadOrganization(access, orgChild)).toBe(false);
    expect(canAdministerOrganization(access, orgChild)).toBe(false);
    expect(canSeeAffiliation(access, foreignOrg)).toBe(false);
    expect(canReadOrganization(access, foreignOrg)).toBe(false);
    expect(canAdministerOrganization(access, foreignOrg)).toBe(false);
    expect(readableOrganizationIds(access)).toEqual([orgA]);
    expect(affiliationOrganizationIds(access).sort()).toEqual([orgA, orgChild].sort());
  });

  it('never consults a platform title: a platform administrator with no membership has no organization', async () => {
    m.isPlatformAdminUser.mockResolvedValue(true);
    const tx = systemTransaction([], [{ id: orgChild }]);
    m.withSystemContext.mockImplementation(async (callback: (systemTx: typeof tx) => unknown) => callback(tx));
    const { resolveOrganizationAccess, canSeeAffiliation, readableOrganizationIds, affiliationOrganizationIds } = await import('../read-authority');
    const access = await resolveOrganizationAccess('platform-user');
    expect(m.isPlatformAdminUser).not.toHaveBeenCalled();
    expect(access).toEqual({ direct: new Map(), affiliated: new Set() });
    expect(canSeeAffiliation(access, orgChild)).toBe(false);
    expect(readableOrganizationIds(access)).toEqual([]);
    expect(affiliationOrganizationIds(access)).toEqual([]);
  });

  it('keeps a directly held organization out of the affiliated set even when it is also below one the caller administers', async () => {
    const tx = systemTransaction([{ organizationId: orgA, role: 'admin' }, { organizationId: orgChild, role: 'member' }], [{ id: orgChild }]);
    m.withSystemContext.mockImplementation(async (callback: (systemTx: typeof tx) => unknown) => callback(tx));
    const { resolveOrganizationAccess, canAdministerOrganization, canReadOrganization } = await import('../read-authority');
    const access = await resolveOrganizationAccess('user-a');
    expect(access.affiliated.has(orgChild)).toBe(false);
    expect(canReadOrganization(access, orgChild)).toBe(true);
    // A member there, not an administrator: administering the parent adds nothing.
    expect(canAdministerOrganization(access, orgChild)).toBe(false);
  });

  it('projects a directory entry with identity and placement only', async () => {
    const { directoryProjection } = await import('../read-authority');
    const row = {
      id: orgA, name: 'A', slug: 'a', organizationType: 'local', parentId: null, hierarchyLevel: 0, hierarchyPath: [], status: 'active',
      email: 'x@a.example', memberCount: 9, settings: { secret: true },
    };
    expect(directoryProjection(row)).toEqual({
      id: orgA, name: 'A', slug: 'a', organization_type: 'local', parent_id: null, hierarchy_level: 0, hierarchy_path: [], status: 'active',
    });
  });

  it('does not query descendant organizations for a non-administrator', async () => {
    const tx = systemTransaction([{ organizationId: orgA, role: 'member' }], [{ id: orgChild }]);
    m.withSystemContext.mockImplementation(async (callback: (systemTx: typeof tx) => unknown) => callback(tx));
    const { resolveOrganizationAccess, canReadOrganization } = await import('../read-authority');
    const access = await resolveOrganizationAccess('user-a');
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(canReadOrganization(access, orgChild)).toBe(false);
  });

  it('fails closed when the membership transaction cannot be established', async () => {
    m.withSystemContext.mockRejectedValue(new Error('system database unavailable'));
    const { resolveOrganizationAccess } = await import('../read-authority');
    await expect(resolveOrganizationAccess('user-a')).rejects.toThrow('system database unavailable');
  });
});
