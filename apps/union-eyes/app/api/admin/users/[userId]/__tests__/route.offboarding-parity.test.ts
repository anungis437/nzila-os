/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 12: offboarding cannot be certified from an emitted
 * event. This route no longer emits `member.status_changed` to trigger
 * revocation asynchronously — it resolves {membershipId, authUserId,
 * organizationId} under withSystemContext() and calls
 * revokeMemberAccess() SYNCHRONOUSLY, returning 502 (not 200) if any
 * required revocation step fails. These tests prove:
 *   1. non-platform-admin callers are rejected before any system-scoped
 *      execution (both PUT and DELETE);
 *   2. the [userId] route param (membershipId) is NEVER passed to
 *      revokeMemberAccess as authUserId — the real
 *      organizationMembers.userId column value is, even when it differs
 *      from the membership row id;
 *   3. a failing revocation (success: false) surfaces as a non-2xx
 *      response, not a false "success: true";
 *   4. reactivation (inactive -> active) does not invoke revocation;
 *   5. a missing membership row 404s before any revocation is attempted.
 *
 * PR #752 round 13: reactivation now calls reactivateMemberAccess()
 * (round-12's reactivation branch only restored organization_members
 * .status, leaving the durable authOrganizationUsers membership disabled
 * — a "successfully reactivated" member could still fail the canonical
 * role resolver). Added: reactivation resolves the real authUserId and
 * fails closed (502) if reactivateMemberAccess reports failure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  selectWhere: vi.fn(),
  updateWhere: vi.fn(),
  revokeMemberAccess: vi.fn(),
  reactivateMemberAccess: vi.fn(),
  resolveOrganizationAccess: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));
vi.mock('@/db/schema', () => ({
  organizationMembers: {
    id: 'id',
    status: 'status',
    organizationId: 'organizationId',
    userId: 'userId',
    role: 'role',
    deletedAt: 'deletedAt',
    updatedAt: 'updatedAt',
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (operation: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: m.selectWhere }) }) }),
      update: () => ({ set: () => ({ where: m.updateWhere }) }),
    };
    return operation(tx);
  },
}));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveOrganizationAccess,
  isAdministrativeRole: (role?: string) => role === 'admin',
}));
vi.mock('@/lib/services/member-access-revocation-service', () => ({
  revokeMemberAccess: m.revokeMemberAccess,
  reactivateMemberAccess: m.reactivateMemberAccess,
}));

async function loadRoute() {
  return import('../route');
}

describe('admin users route — synchronous fail-closed offboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'platform-admin-1' });
    m.resolveOrganizationAccess.mockResolvedValue({ platform: true, direct: new Map([['org-a', 'admin']]), descendants: new Set() });
    m.updateWhere.mockResolvedValue(undefined);
    m.revokeMemberAccess.mockResolvedValue({
      success: true,
      sessionsRevoked: true,
      authMembershipDisabled: true,
      caseAccessRevokedCount: 0,
      localStatusUpdated: true,
      errors: [],
    });
    m.reactivateMemberAccess.mockResolvedValue({
      success: true,
      authMembershipReenabled: true,
      localStatusUpdated: true,
      errors: [],
    });
  });

  it('rejects a platform-only caller without direct tenant office before any system execution', async () => {
    m.auth.mockResolvedValue({ userId: 'platform-only' });
    m.resolveOrganizationAccess.mockResolvedValue({ platform: true, direct: new Map(), descendants: new Set() });
    const { PUT, DELETE } = await loadRoute();
    const params = Promise.resolve({ userId: 'membership-row-1' });

    const putRes = await PUT({} as never, { params });
    const delRes = await DELETE({} as never, { params });

    expect(putRes.status).toBe(403);
    expect(delRes.status).toBe(403);
    expect(m.selectWhere).not.toHaveBeenCalled();
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
    expect(m.reactivateMemberAccess).not.toHaveBeenCalled();
  });

  it('PUT (active -> inactive) resolves the real authUserId (organizationMembers.userId), NOT the membershipId route param', async () => {
    // membershipId (route param) and authUserId are DELIBERATELY different
    // UUIDs here — proves the fix for the round-11/12 identity bug where
    // the membership row id was passed to session/case-access revocation.
    m.selectWhere.mockResolvedValue([
      { status: 'active', organizationId: 'org-a', authUserId: 'real-auth-user-999', role: 'member' },
    ]);
    const { PUT } = await loadRoute();

    const res = await PUT({} as never, { params: Promise.resolve({ userId: 'membership-row-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, status: 'inactive' });
    expect(m.revokeMemberAccess).toHaveBeenCalledWith({
      membershipId: 'membership-row-1',
      authUserId: 'real-auth-user-999',
      organizationId: 'org-a',
      actorUserId: 'platform-admin-1',
      newLocalStatus: 'inactive',
    });
  });

  it('DELETE (soft-delete) also resolves the real authUserId and calls revokeMemberAccess with newLocalStatus "deleted"', async () => {
    m.selectWhere.mockResolvedValue([
      { status: 'active', organizationId: 'org-a', authUserId: 'real-auth-user-999', role: 'member' },
    ]);
    const { DELETE } = await loadRoute();

    const res = await DELETE({} as never, { params: Promise.resolve({ userId: 'membership-row-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(m.revokeMemberAccess).toHaveBeenCalledWith({
      membershipId: 'membership-row-1',
      authUserId: 'real-auth-user-999',
      organizationId: 'org-a',
      actorUserId: 'platform-admin-1',
      newLocalStatus: 'deleted',
    });
  });

  it('PUT (inactive -> active reactivation) calls reactivateMemberAccess with the real authUserId, not revokeMemberAccess', async () => {
    m.selectWhere.mockResolvedValue([
      { status: 'inactive', organizationId: 'org-a', authUserId: 'real-auth-user-999', role: 'member' },
    ]);
    const { PUT } = await loadRoute();

    const res = await PUT({} as never, { params: Promise.resolve({ userId: 'membership-row-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, status: 'active' });
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
    expect(m.reactivateMemberAccess).toHaveBeenCalledWith({
      membershipId: 'membership-row-1',
      authUserId: 'real-auth-user-999',
      organizationId: 'org-a',
      actorUserId: 'platform-admin-1',
    });
  });

  it('PUT reactivation returns 502 (not 200) when reactivateMemberAccess reports failure', async () => {
    m.selectWhere.mockResolvedValue([
      { status: 'inactive', organizationId: 'org-a', authUserId: 'real-auth-user-999', role: 'member' },
    ]);
    m.reactivateMemberAccess.mockResolvedValue({
      success: false,
      authMembershipReenabled: false,
      localStatusUpdated: true,
      errors: ['auth_membership_reenable_failed: connection reset'],
    });
    const { PUT } = await loadRoute();

    const res = await PUT({} as never, { params: Promise.resolve({ userId: 'membership-row-1' }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.details).toEqual(['auth_membership_reenable_failed: connection reset']);
  });

  it('PUT returns 502 (not 200) when revokeMemberAccess reports failure — offboarding is never certified from a partial revocation', async () => {
    m.selectWhere.mockResolvedValue([
      { status: 'active', organizationId: 'org-a', authUserId: 'real-auth-user-999', role: 'member' },
    ]);
    m.revokeMemberAccess.mockResolvedValue({
      success: false,
      sessionsRevoked: true,
      authMembershipDisabled: false,
      caseAccessRevokedCount: 0,
      localStatusUpdated: false,
      errors: ['auth_membership_disable_failed: connection reset'],
    });
    const { PUT } = await loadRoute();

    const res = await PUT({} as never, { params: Promise.resolve({ userId: 'membership-row-1' }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBeTruthy();
    expect(body.details).toEqual(['auth_membership_disable_failed: connection reset']);
  });

  it('DELETE returns 502 (not 200) when revokeMemberAccess reports failure', async () => {
    m.selectWhere.mockResolvedValue([
      { status: 'active', organizationId: 'org-a', authUserId: 'real-auth-user-999', role: 'member' },
    ]);
    m.revokeMemberAccess.mockResolvedValue({
      success: false,
      sessionsRevoked: false,
      authMembershipDisabled: true,
      caseAccessRevokedCount: 0,
      localStatusUpdated: true,
      errors: ['session_revocation_failed: timeout'],
    });
    const { DELETE } = await loadRoute();

    const res = await DELETE({} as never, { params: Promise.resolve({ userId: 'membership-row-1' }) });
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.details).toEqual(['session_revocation_failed: timeout']);
  });

  it('DELETE returns 404 without invoking revocation when the member does not exist', async () => {
    m.selectWhere.mockResolvedValue([]);
    const { DELETE } = await loadRoute();

    const res = await DELETE({} as never, { params: Promise.resolve({ userId: 'ghost' }) });

    expect(res.status).toBe(404);
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
  });

  it('PUT returns 404 without invoking revocation when the member does not exist', async () => {
    m.selectWhere.mockResolvedValue([]);
    const { PUT } = await loadRoute();

    const res = await PUT({} as never, { params: Promise.resolve({ userId: 'ghost' }) });

    expect(res.status).toBe(404);
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
  });
  it('denies a direct admin from deactivating a different tenant member', async () => {
    m.selectWhere.mockResolvedValue([{ status: 'active', organizationId: 'org-b', authUserId: 'other', role: 'member' }]);
    const { PUT } = await loadRoute();
    const response = await PUT({} as never, { params: Promise.resolve({ userId: 'member-org-b' }) });
    expect(response.status).toBe(404);
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
  });

  it('denies single-administrator privileged reactivation without approval evidence', async () => {
    m.selectWhere.mockResolvedValue([{ status: 'inactive', organizationId: 'org-a', authUserId: 'officer-1', role: 'admin' }]);
    const { PUT } = await loadRoute();
    const response = await PUT({} as never, { params: Promise.resolve({ userId: 'admin-membership-id' }) });
    expect(response.status).toBe(409);
    expect(m.reactivateMemberAccess).not.toHaveBeenCalled();
  });

  it('denies self-offboarding without independent authorization', async () => {
    m.selectWhere.mockResolvedValue([{ status: 'active', organizationId: 'org-a', authUserId: 'platform-admin-1', role: 'admin' }]);
    const { DELETE } = await loadRoute();
    const response = await DELETE({} as never, { params: Promise.resolve({ userId: 'self-membership-id' }) });
    expect(response.status).toBe(409);
    expect(m.revokeMemberAccess).not.toHaveBeenCalled();
  });

});
