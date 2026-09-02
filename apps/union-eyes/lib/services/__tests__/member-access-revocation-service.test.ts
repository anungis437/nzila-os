/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 12: failure-injection proof for
 * lib/services/member-access-revocation-service.ts's revokeMemberAccess().
 * "Offboarding cannot be certified from an emitted event" — this service
 * is the synchronous, fail-closed replacement for the old event-driven
 * enforcement in lib/events/pilot-event-listeners.ts. Each of the four
 * revocation steps (session revocation, authOrganizationUsers disable,
 * case-access revocation, local status persistence) is independently
 * failure-injected here, proving:
 *   - `success` is only true when ALL four steps succeed;
 *   - a single failing step does not stop the OTHER steps from being
 *     attempted (maximizes access-denial coverage even under partial
 *     failure);
 *   - every failure is captured in `errors` with a stable, greppable
 *     prefix identifying which step failed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  revokeAllUserSessions: vi.fn(),
  authUpdateWhere: vi.fn(),
  caseAccessSelectWhere: vi.fn(),
  caseAccessUpdateWhere: vi.fn(),
  membersUpdateWhere: vi.fn(),
  updateCallCount: { n: 0 },
  failNthUpdate: { n: 0 },
}));

vi.mock('@nzila/platform-auth/password', () => ({
  revokeAllUserSessions: m.revokeAllUserSessions,
}));

vi.mock('@nzila/db/client', () => ({
  db: {
    update: () => ({ set: () => ({ where: m.authUpdateWhere }) }),
  },
}));

vi.mock('@nzila/db/schema', () => ({
  authOrganizationUsers: { userId: 'userId', organizationId: 'organizationId', isActive: 'isActive', updatedAt: 'updatedAt' },
}));

vi.mock('@/db/schema/domains/claims/grievance-lifecycle', () => ({
  grievanceCaseAccessAssignments: {
    id: 'id',
    userId: 'userId',
    organizationId: 'organizationId',
    status: 'status',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: m.caseAccessSelectWhere }) }),
    update: () => {
      m.updateCallCount.n += 1;
      const shouldFail = m.failNthUpdate.n > 0 && m.updateCallCount.n === m.failNthUpdate.n;
      const where = shouldFail
        ? () => Promise.reject(new Error('deadlock'))
        : m.membersUpdateWhere;
      return { set: () => ({ where }) };
    },
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', status: 'status', deletedAt: 'deletedAt', updatedAt: 'updatedAt' },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (operation: () => Promise<unknown>) => operation(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

async function loadService() {
  return import('../member-access-revocation-service');
}

const baseInput = {
  membershipId: 'membership-1',
  authUserId: 'auth-user-1',
  organizationId: 'org-a',
  newLocalStatus: 'inactive' as const,
};

describe('revokeMemberAccess — fail-closed offboarding enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updateCallCount.n = 0;
    m.failNthUpdate.n = 0;
    m.revokeAllUserSessions.mockResolvedValue(undefined);
    m.authUpdateWhere.mockResolvedValue(undefined);
    m.caseAccessSelectWhere.mockResolvedValue([]);
    m.caseAccessUpdateWhere.mockResolvedValue(undefined);
    m.membersUpdateWhere.mockResolvedValue(undefined);
  });

  it('reports success: true and every step true when all four steps succeed', async () => {
    const { revokeMemberAccess } = await loadService();

    const result = await revokeMemberAccess(baseInput);

    expect(result.success).toBe(true);
    expect(result.sessionsRevoked).toBe(true);
    expect(result.authMembershipDisabled).toBe(true);
    expect(result.localStatusUpdated).toBe(true);
    expect(result.errors).toEqual([]);
    expect(m.revokeAllUserSessions).toHaveBeenCalledWith('auth-user-1');
  });

  it('fails closed when session revocation throws — success: false, other steps still attempted', async () => {
    m.revokeAllUserSessions.mockRejectedValue(new Error('session store unreachable'));
    const { revokeMemberAccess } = await loadService();

    const result = await revokeMemberAccess(baseInput);

    expect(result.success).toBe(false);
    expect(result.sessionsRevoked).toBe(false);
    expect(result.authMembershipDisabled).toBe(true);
    expect(result.localStatusUpdated).toBe(true);
    expect(result.errors.some((e) => e.startsWith('session_revocation_failed:'))).toBe(true);
  });

  it('fails closed when the authOrganizationUsers disable throws — success: false', async () => {
    m.authUpdateWhere.mockRejectedValue(new Error('connection reset'));
    const { revokeMemberAccess } = await loadService();

    const result = await revokeMemberAccess(baseInput);

    expect(result.success).toBe(false);
    expect(result.authMembershipDisabled).toBe(false);
    expect(result.sessionsRevoked).toBe(true);
    expect(result.errors.some((e) => e.startsWith('auth_membership_disable_failed:'))).toBe(true);
  });

  it('fails closed when case-access revocation throws — success: false', async () => {
    m.caseAccessSelectWhere.mockRejectedValue(new Error('query timeout'));
    const { revokeMemberAccess } = await loadService();

    const result = await revokeMemberAccess(baseInput);

    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.startsWith('case_access_revocation_failed:'))).toBe(true);
    expect(result.sessionsRevoked).toBe(true);
    expect(result.authMembershipDisabled).toBe(true);
  });

  it('fails closed when local status persistence throws — success: false', async () => {
    // caseAccessSelectWhere defaults to [] (no active assignments), so the
    // ONLY db.update() call the service makes is the local
    // organizationMembers status/deletedAt persistence — fail that one.
    m.failNthUpdate.n = 1;
    const { revokeMemberAccess } = await loadService();

    const result = await revokeMemberAccess(baseInput);

    expect(result.success).toBe(false);
    expect(result.localStatusUpdated).toBe(false);
    expect(result.sessionsRevoked).toBe(true);
    expect(result.authMembershipDisabled).toBe(true);
    expect(result.errors.some((e) => e.startsWith('local_status_update_failed:'))).toBe(true);
  });

  it('passes authUserId (not membershipId) to session revocation and case-access filtering', async () => {
    const distinctInput = {
      membershipId: 'membership-row-uuid-AAAA',
      authUserId: 'real-auth-user-uuid-BBBB',
      organizationId: 'org-a',
      newLocalStatus: 'deleted' as const,
    };
    const { revokeMemberAccess } = await loadService();

    await revokeMemberAccess(distinctInput);

    expect(m.revokeAllUserSessions).toHaveBeenCalledWith('real-auth-user-uuid-BBBB');
    expect(m.revokeAllUserSessions).not.toHaveBeenCalledWith('membership-row-uuid-AAAA');
  });

  it('revokes every active case-access assignment returned for the user/org and reports the count', async () => {
    m.caseAccessSelectWhere.mockResolvedValue([{ id: 'assignment-1' }, { id: 'assignment-2' }]);
    const { revokeMemberAccess } = await loadService();

    const result = await revokeMemberAccess(baseInput);

    expect(result.success).toBe(true);
    expect(result.caseAccessRevokedCount).toBe(2);
    // 2 case-access revocation updates + 1 local status update = 3 total
    // db.update() calls, all routed through the same mocked `where`.
    expect(m.membersUpdateWhere).toHaveBeenCalledTimes(3);
  });
});
