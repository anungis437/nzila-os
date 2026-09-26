import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  selectQueue: [] as unknown[][],
  withSystemContext: vi.fn(),
  withExplicitUserContext: vi.fn(),
}));

// A single-row workbook select chain fed by selectQueue. The claimed-workbook
// authority resolver performs its trusted ownership lookup through this handle
// (passed as the system-context `tx`).
const mockTx = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (...args: unknown[]) => m.withSystemContext(...args),
  withExplicitUserContext: (...args: unknown[]) => m.withExplicitUserContext(...args),
}));

async function loadModule() {
  return import('../access-control');
}

// ROUND 50 REGRESSION: once a workbook is claimed, its identity-linked child
// data (memory holders etc.) must require claimant/same-org access — the
// workbookId bearer credential is no longer sufficient.
//
// TRANCHE 4: authorization is resolved via a trusted, minimal ownership lookup
// that runs under a bounded system context (so the decision does not depend on
// a caller context that has not been established yet), and the execution
// boundary then runs protected work in the DB context matching the authority.
describe('claimed-workbook access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withSystemContext.mockImplementation((cb: any) => cb(mockTx));
    m.withExplicitUserContext.mockImplementation((_userId: string, cb: any) => cb());
  });

  describe('verifyClaimedWorkbookAccess', () => {
    it('returns 404 when the workbook does not exist', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([]);

      const result = await verifyClaimedWorkbookAccess('missing');

      expect(result).toEqual({ ok: false, status: 404, error: 'Workbook not found' });
      // Ownership lookup ran under a bounded system context.
      expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    });

    it('allows an unclaimed workbook via the bearer id alone (pseudonymous by design)', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);

      const result = await verifyClaimedWorkbookAccess('w1');

      expect(result).toEqual({ ok: true });
      expect(m.auth).not.toHaveBeenCalled();
    });

    it('returns 401 for a claimed workbook when the caller is unauthenticated', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: null });

      const result = await verifyClaimedWorkbookAccess('w1');

      expect(result).toEqual({ ok: false, status: 401, error: 'Authentication required' });
    });

    it('allows access when the caller is the claimant', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'owner_1' });

      const result = await verifyClaimedWorkbookAccess('w1');

      expect(result).toEqual({ ok: true });
      // Claimant is recognized without an org lookup.
      expect(m.getOrganizationIdForUser).not.toHaveBeenCalled();
    });

    it('allows access when the caller shares the workbook claimed organization', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_shared' }]);
      m.auth.mockResolvedValueOnce({ userId: 'coworker_1' });
      // Canonical same-org anchor is the stored claimed_org_id; only the
      // requester's org is resolved.
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');

      const result = await verifyClaimedWorkbookAccess('w1');

      expect(result).toEqual({ ok: true });
      expect(m.getOrganizationIdForUser).toHaveBeenCalledTimes(1);
    });

    it('returns 403 for a different user in a different organization (cross-tenant IDOR regression)', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'attacker_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_attacker');

      const result = await verifyClaimedWorkbookAccess('w1');

      expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden' });
    });

    it('falls back to the claimant resolved org for legacy rows without claimed_org_id', async () => {
      const { verifyClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: null }]);
      m.auth.mockResolvedValueOnce({ userId: 'coworker_1' });
      m.getOrganizationIdForUser
        .mockResolvedValueOnce('org_shared') // requester
        .mockResolvedValueOnce('org_shared'); // owner (fallback resolution)

      const result = await verifyClaimedWorkbookAccess('w1');

      expect(result).toEqual({ ok: true });
      expect(m.getOrganizationIdForUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('withClaimedWorkbookAccess', () => {
    it('runs the callback under the claimant user context', async () => {
      const { withClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'owner_1' });

      const cb = vi.fn(async () => 'RESULT');
      const result = await withClaimedWorkbookAccess({ workbookId: 'w1', operation: 'read' }, cb);

      expect(result).toEqual(
        expect.objectContaining({ ok: true, value: 'RESULT' }),
      );
      if (result.ok) {
        expect(result.authority.kind).toBe('claimant');
        // The DB session principal IS the real actor (the claimant).
        expect(result.authority.actorUserId).toBe('owner_1');
      }
      // Claimant executes under its own user context, not system.
      expect(m.withExplicitUserContext).toHaveBeenCalledTimes(1);
      expect(m.withExplicitUserContext.mock.calls[0][0]).toBe('owner_1');
      // Only the ownership lookup used the system context.
      expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    });

    it('runs the same-org callback under a bounded system context (no owner impersonation)', async () => {
      const { withClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_shared' }]);
      m.auth.mockResolvedValueOnce({ userId: 'peer_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');

      const cb = vi.fn(async () => 'OK');
      const result = await withClaimedWorkbookAccess({ workbookId: 'w1', operation: 'write' }, cb);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.authority.kind).toBe('same_org');
        // The real acting principal is the peer — NOT the owner. The owner is
        // never impersonated, so a peer write can never be silently attributed
        // to the owner.
        expect(result.authority.actorUserId).toBe('peer_1');
        expect(result.authority.claimedByUserId).toBe('owner_1');
      }
      // Executed under system (ownership lookup + callback) — never as a user,
      // and never as the owner.
      expect(m.withExplicitUserContext).not.toHaveBeenCalled();
      expect(m.withSystemContext).toHaveBeenCalledTimes(2);
    });

    it('runs the preclaim callback under a bounded system context', async () => {
      const { withClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: null, claimedOrgId: null }]);

      const cb = vi.fn(async () => 'PRECLAIM');
      const result = await withClaimedWorkbookAccess({ workbookId: 'w1', operation: 'write' }, cb);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.authority.kind).toBe('preclaim');
      expect(m.withExplicitUserContext).not.toHaveBeenCalled();
      // Ownership lookup + callback both ran under system context.
      expect(m.withSystemContext).toHaveBeenCalledTimes(2);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not run the callback when authorization is denied', async () => {
      const { withClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1', claimedOrgId: 'org_owner' }]);
      m.auth.mockResolvedValueOnce({ userId: 'attacker_1' });
      m.getOrganizationIdForUser.mockResolvedValueOnce('org_attacker');

      const cb = vi.fn(async () => 'SHOULD_NOT_RUN');
      const result = await withClaimedWorkbookAccess({ workbookId: 'w1', operation: 'read' }, cb);

      expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden' });
      expect(cb).not.toHaveBeenCalled();
      expect(m.withExplicitUserContext).not.toHaveBeenCalled();
    });

    it('does not run the callback when the workbook is missing', async () => {
      const { withClaimedWorkbookAccess } = await loadModule();
      m.selectQueue.push([]);

      const cb = vi.fn(async () => 'SHOULD_NOT_RUN');
      const result = await withClaimedWorkbookAccess({ workbookId: 'missing', operation: 'read' }, cb);

      expect(result).toEqual({ ok: false, status: 404, error: 'Workbook not found' });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
