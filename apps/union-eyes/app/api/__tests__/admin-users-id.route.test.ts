import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  memberRecord: undefined as Record<string, unknown> | undefined,
  direct: new Map<string, string>(),
  resolveOrganizationAccess: vi.fn(),
  revokeMemberAccess: vi.fn(),
  reactivateMemberAccess: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', () => ({
  isPlatformAdminUser: async (userId: string) => userId === 'admin_u1',
  ROLE_HIERARCHY: { member: 20, steward: 50, officer: 80, admin: 100 },
}));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: vi.fn(async () => ORG) }));
vi.mock('@/lib/platform/platform-staff', () => ({ requirePlatformStaffAuthority: vi.fn(async (context) => context) }));
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@/db/schema', () => ({ organizationMembers: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) =>
    operation({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => (m.memberRecord ? [m.memberRecord] : []) }) }) }),
    }),
  ),
}));
vi.mock('@/lib/services/member-access-revocation-service', () => ({
  revokeMemberAccess: m.revokeMemberAccess,
  reactivateMemberAccess: m.reactivateMemberAccess,
}));
vi.mock('@/lib/organizations/read-authority', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/organizations/read-authority')>()),
  resolveOrganizationAccess: m.resolveOrganizationAccess,
}));

async function loadRoute() {
  return import('../admin/users/[userId]/route');
}

const put = async (membershipId = 'membership_1') => {
  const { PUT } = await loadRoute();
  return PUT(new Request(`http://localhost/api/admin/users/${membershipId}`, { method: "PUT" }) as never, {
    params: Promise.resolve({ userId: membershipId }),
  });
};
const del = async (membershipId = 'membership_1') => {
  const { DELETE } = await loadRoute();
  return DELETE(new Request(`http://localhost/api/admin/users/${membershipId}`, { method: "DELETE" }) as never, {
    params: Promise.resolve({ userId: membershipId }),
  });
};

describe('admin/users/[userId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PLATFORM_ADMIN_USER_IDS', 'admin_u1');
    m.auth.mockResolvedValue({ userId: 'admin_u1' });
    m.memberRecord = { status: 'active', role: 'member', organizationId: ORG, authUserId: 'member_u2' };
    // The platform administrator is also a live, direct administrator of ORG.
    m.direct = new Map([[ORG, 'admin']]);
    m.resolveOrganizationAccess.mockImplementation(async () => ({ platform: true, direct: m.direct, descendants: new Set() }));
    m.revokeMemberAccess.mockResolvedValue({ success: true, errors: [] });
    m.reactivateMemberAccess.mockResolvedValue({ success: true, errors: [] });
  });

  it('PUT and DELETE return 403 when the caller is not a platform administrator', async () => {
    m.auth.mockResolvedValue({ userId: 'not_admin' });
    expect((await put()).status).toBe(403);
    expect((await del()).status).toBe(403);
    expect(m.resolveOrganizationAccess).not.toHaveBeenCalled();
  });

  it('PUT and DELETE return 404 for a membership that does not exist', async () => {
    m.memberRecord = undefined;
    expect((await put()).status).toBe(404);
    expect((await del()).status).toBe(404);
  });

  it('PUT deactivates a member of an organization the caller directly administers', async () => {
    const response = await put();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: 'inactive' });
    expect(m.resolveOrganizationAccess).toHaveBeenCalledWith('admin_u1');
    expect(m.revokeMemberAccess).toHaveBeenCalledWith(
      expect.objectContaining({ membershipId: 'membership_1', authUserId: 'member_u2', organizationId: ORG, actorUserId: 'admin_u1', newLocalStatus: 'inactive' }),
    );
  });

  it('DELETE removes a member of an organization the caller directly administers', async () => {
    const response = await del();
    expect(response.status).toBe(200);
    expect(m.revokeMemberAccess).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, newLocalStatus: 'deleted' }));
  });

  // #1116: the platform title alone is not enough, and the refusal does not disclose that the membership exists.
  it('PUT and DELETE answer 404, not 403, to a platform administrator with no direct administration of the member organization', async () => {
    m.direct = new Map();
    for (const response of [await put(), await del()]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Member not found' });
    }
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
    expect(m.reactivateMemberAccess).not.toHaveBeenCalled();
  });

  it('PUT and DELETE answer 404 to an administrator of a different organization, or a plain member of this one', async () => {
    m.direct = new Map([[OTHER_ORG, 'admin']]);
    expect((await put()).status).toBe(404);
    expect((await del()).status).toBe(404);

    m.direct = new Map([[ORG, 'steward']]);
    expect((await put()).status).toBe(404);
    expect((await del()).status).toBe(404);
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
  });

  it('PUT and DELETE answer 409 when the caller targets their own membership', async () => {
    m.memberRecord = { status: 'active', role: 'admin', organizationId: ORG, authUserId: 'admin_u1' };
    for (const response of [await put(), await del()]) {
      expect(response.status).toBe(409);
    }
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
  });

  it('PUT reactivates an inactive plain member', async () => {
    m.memberRecord = { status: 'inactive', role: 'member', organizationId: ORG, authUserId: 'member_u2' };
    const response = await put();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, status: 'active' });
    expect(m.reactivateMemberAccess).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, actorUserId: 'admin_u1' }));
  });

  it('PUT refuses with 409 to reactivate a member holding an officer role or above, or an unrecognised role', async () => {
    for (const role of ['officer', 'chief_steward', 'president', 'admin', 'not_a_known_role']) {
      m.memberRecord = { status: 'inactive', role, organizationId: ORG, authUserId: 'member_u2' };
      const response = await put();
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: 'Privileged reactivation requires independent office approval' });
    }
    expect(m.reactivateMemberAccess).not.toHaveBeenCalled();
  });

  it('PUT still deactivates a privileged member: only reactivation needs the independent approval', async () => {
    m.memberRecord = { status: 'active', role: 'president', organizationId: ORG, authUserId: 'member_u2' };
    expect((await put()).status).toBe(200);
    expect(m.revokeMemberAccess).toHaveBeenCalledOnce();
  });
});
