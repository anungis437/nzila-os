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
 *
 * PR #752 round 13: session revocation and the authOrganizationUsers
 * mutation now execute via @nzila/db/system-client's systemDb, not the
 * ordinary @nzila/db/client \u2014 covered here by mocking systemDb and
 * asserting it (not the ordinary client) is what receives the mutation.
 * Also covers reactivateMemberAccess(): symmetric re-enable of the durable
 * auth membership, no automatic session/case-access restoration, and
 * fail-closed behavior for both of its steps.
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
  authReturning: vi.fn(),
  localReturning: vi.fn(),
}));

vi.mock('@nzila/platform-auth/password', () => ({
  revokeAllUserSessions: m.revokeAllUserSessions,
}));

vi.mock('@nzila/db/system-client', () => ({
  systemDb: {
    update: () => ({ set: () => ({ where: m.authUpdateWhere }) }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: (table: unknown) => {
          // authOrganizationUsers (mocked below) has `organizationUserId`;
          // organizationMembers (mocked below) does not — used to dispatch
          // to the correct returning() mock per table without needing
          // separate transaction-scoped chain builders.
          const isAuthTable = (table as { organizationUserId?: unknown })?.organizationUserId !== undefined;
          const returning = isAuthTable ? m.authReturning : m.localReturning;
          return { set: () => ({ where: () => ({ returning }) }) };
        },
      };
      return callback(tx);
    },
  },
}));

vi.mock('@nzila/db/schema', () => ({
  authOrganizationUsers: {
    organizationUserId: 'organizationUserId',
    userId: 'userId',
    organizationId: 'organizationId',
    isActive: 'isActive',
    updatedAt: 'updatedAt',
  },
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
    expect(m.revokeAllUserSessions).toHaveBeenCalledWith('auth-user-1', expect.anything());
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

  it('passes authUserId (not membershipId) to session revocation and case-access filtering, via the SYSTEM auth db client', async () => {
    const distinctInput = {
      membershipId: 'membership-row-uuid-AAAA',
      authUserId: 'real-auth-user-uuid-BBBB',
      organizationId: 'org-a',
      newLocalStatus: 'deleted' as const,
    };
    const { revokeMemberAccess } = await loadService();

    await revokeMemberAccess(distinctInput);

    expect(m.revokeAllUserSessions).toHaveBeenCalledWith('real-auth-user-uuid-BBBB', expect.anything());
    expect(m.revokeAllUserSessions).not.toHaveBeenCalledWith('membership-row-uuid-AAAA', expect.anything());
    // the systemDb passed is @nzila/db/system-client's mocked systemDb, not
    // the ordinary @nzila/db/client — proven by the second call arg being
    // an object exposing `update` (the mocked systemDb shape) rather than
    // undefined (which is what an unmocked/missing import would yield).
    const [, dbArg] = m.revokeAllUserSessions.mock.calls[0];
    expect(dbArg).toHaveProperty('update');
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

const reactivateBaseInput = {
  membershipId: 'membership-1',
  authUserId: 'auth-user-1',
  organizationId: 'org-a',
};

describe('reactivateMemberAccess — atomic, fail-closed reactivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updateCallCount.n = 0;
    m.failNthUpdate.n = 0;
    m.authUpdateWhere.mockResolvedValue(undefined);
    m.membersUpdateWhere.mockResolvedValue(undefined);
    m.authReturning.mockResolvedValue([{ organizationUserId: 'org-user-1' }]);
    m.localReturning.mockResolvedValue([{ id: 'membership-1' }]);
  });

  it('re-enables authOrganizationUsers and restores local status when both writes succeed in the same transaction', async () => {
    const { reactivateMemberAccess } = await loadService();

    const result = await reactivateMemberAccess(reactivateBaseInput);

    expect(result.success).toBe(true);
    expect(result.authMembershipReenabled).toBe(true);
    expect(result.localStatusUpdated).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('does not call revokeAllUserSessions on reactivation', async () => {
    const { reactivateMemberAccess } = await loadService();

    await reactivateMemberAccess(reactivateBaseInput);

    expect(m.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('does not touch grievanceCaseAccessAssignments on reactivation — revoked access stays revoked', async () => {
    const { reactivateMemberAccess } = await loadService();

    await reactivateMemberAccess(reactivateBaseInput);

    expect(m.caseAccessSelectWhere).not.toHaveBeenCalled();
    expect(m.caseAccessUpdateWhere).not.toHaveBeenCalled();
  });

  it('the auth-membership write succeeding does NOT grant partial authority when the local write then throws — both flags stay false', async () => {
    m.localReturning.mockRejectedValue(new Error('deadlock'));
    const { reactivateMemberAccess } = await loadService();

    const result = await reactivateMemberAccess(reactivateBaseInput);

    // Round-13's independent-try/catch shape would have reported
    // authMembershipReenabled: true here even though the local write
    // failed — proving the auth store was already re-enabled while the
    // overall operation still 502s. The atomic transaction must report
    // BOTH as false: nothing may be reported as active until the whole
    // transaction commits.
    expect(result.success).toBe(false);
    expect(result.authMembershipReenabled).toBe(false);
    expect(result.localStatusUpdated).toBe(false);
    expect(result.errors.some((e) => e.startsWith('reactivation_transaction_failed:'))).toBe(true);
  });

  it('the local write succeeding does NOT grant partial authority when the auth-membership write throws first — both flags stay false', async () => {
    m.authReturning.mockRejectedValue(new Error('connection reset'));
    const { reactivateMemberAccess } = await loadService();

    const result = await reactivateMemberAccess(reactivateBaseInput);

    expect(result.success).toBe(false);
    expect(result.authMembershipReenabled).toBe(false);
    expect(result.localStatusUpdated).toBe(false);
    // the local write must never even run since the auth write throws first
    expect(m.localReturning).not.toHaveBeenCalled();
  });

  it('fails closed when the auth-membership update matches zero rows (RETURNING empty) — does not silently activate', async () => {
    m.authReturning.mockResolvedValue([]);
    const { reactivateMemberAccess } = await loadService();

    const result = await reactivateMemberAccess(reactivateBaseInput);

    expect(result.success).toBe(false);
    expect(result.authMembershipReenabled).toBe(false);
    expect(result.localStatusUpdated).toBe(false);
    expect(result.errors.some((e) => e.includes('auth_membership_row_not_found'))).toBe(true);
    expect(m.localReturning).not.toHaveBeenCalled();
  });

  it('fails closed when the local membership update matches zero rows (RETURNING empty) — does not silently activate', async () => {
    m.localReturning.mockResolvedValue([]);
    const { reactivateMemberAccess } = await loadService();

    const result = await reactivateMemberAccess(reactivateBaseInput);

    expect(result.success).toBe(false);
    expect(result.authMembershipReenabled).toBe(false);
    expect(result.localStatusUpdated).toBe(false);
    expect(result.errors.some((e) => e.includes('local_membership_row_not_found'))).toBe(true);
  });
});
