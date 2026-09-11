/**
 * Pilot ownership enforcement — behavioral unit tests (UE Hardening Wave — Phase 2).
 *
 * Proves the allow/deny matrix for acting on a pilot application by ID:
 *   1. same-org steward                → allowed
 *   2. cross-org steward               → denied (403)
 *   3. officer without org ownership   → denied (403)
 *   4. platform actor (system_admin /
 *      app_owner)                      → allowed (cross-org by design)
 *      org-level admin (140)           → still org-scoped (NOT platform)
 *   5. missing org context             → denied (403, fail closed)
 *   6. missing pilot application       → 404 (not a permission leak)
 *   7. unauthenticated actor           → denied (401)
 *
 * Real ROLE_HIERARCHY + normalizeRole are kept (only getCurrentUser is mocked),
 * so the platform-vs-org boundary is asserted against production role levels.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted mocks ──────────────────────────────────────────────────── */

const { mockGetCurrentUser, mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

// Keep the real api-auth-guard (real ROLE_HIERARCHY + normalizeRole) and only
// override identity resolution — mirrors app/api/members cross-org tests.
// hasMinRole is reimplemented against the SAME mocked getCurrentUser (rather
// than the real auth()+DB role-resolution chain, unavailable in this unit
// test) so withPilotOwnership's upfront role gate (PR #752 round 19) is
// exercised faithfully against each fixture's real role level.
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
    hasMinRole: async (minRole: string) => {
      const user = await mockGetCurrentUser();
      if (!user) return false;
      const userLevel = actual.ROLE_HIERARCHY[actual.normalizeRole(user.role ?? 'member')] ?? 0;
      const minLevel = actual.ROLE_HIERARCHY[actual.normalizeRole(minRole)] ?? 0;
      return userLevel >= minLevel;
    },
  };
});

vi.mock('@/db', () => ({ db: { select: mockDbSelect, update: mockDbUpdate } }));
vi.mock('@/db/db', () => ({ db: { select: mockDbSelect, update: mockDbUpdate } }));

// withSystemContext is ALS-routing plumbing (PR #752 rounds 16-18) — the
// mocked `db` above already stands in for both the tenant and system
// connections in these unit tests, so the mock just runs the callback.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: (tx?: unknown) => Promise<unknown>) => fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  authorizePilotAccess,
  getPilotClaimedOrganizationId,
  getPilotVerifiedOrganizationId,
  getPilotEffectiveOrganizationId,
  bindPilotOrganization,
  rebindPilotOrganization,
  enforcePilotOwnership,
  withPilotOwnership,
  PILOT_PLATFORM_ACCESS_MIN_LEVEL,
} from '../pilot-ownership';

/* ── fixtures ───────────────────────────────────────────────────────── */

const ORG_A = 'org-aaaa-1111';
const ORG_B = 'org-bbbb-2222';

const stewardOfA = { id: 'u-steward-a', organizationId: ORG_A, role: 'steward' };
const officerOfA = { id: 'u-officer-a', organizationId: ORG_A, role: 'officer' };
const adminOfA = { id: 'u-admin-a', organizationId: ORG_A, role: 'admin' };
const systemAdmin = { id: 'u-sysadmin', organizationId: ORG_A, role: 'system_admin' };
const appOwner = { id: 'u-appowner', organizationId: null, role: 'app_owner' };
const stewardNoOrg = { id: 'u-steward-noorg', organizationId: null, role: 'steward' };

const pilotOwnedByA = { responses: { organizationId: ORG_A } };
const pilotOwnedByB = { responses: { organizationId: ORG_B } };
const pilotNoOwner = { responses: {} };

/** Records every `.limit(n).for(mode)` row-lock call across a test (PR #752 round 22). */
let lockCalls: Array<{ limit: number; mode: string }> = [];

/**
 * A `where()` result that is both directly awaitable (`await db.select()...
 * where(...)`) AND chainable with `.limit(n).for('update')` (PR #752 round
 * 22's row-lock reads) — same resolved rows either way.
 */
function chainableRows(rows: unknown[]) {
  const thenable = Promise.resolve(rows) as Promise<unknown[]> & {
    limit: (n: number) => { for: (mode: string) => Promise<unknown[]> };
  };
  thenable.limit = (n: number) => ({
    for: (mode: string) => {
      lockCalls.push({ limit: n, mode });
      return Promise.resolve(rows);
    },
  });
  return thenable;
}

/** Configure db.select().from().where() to resolve to the given rows. */
function dbReturns(rows: unknown[]) {
  mockDbSelect.mockImplementation(() => ({
    from: () => ({ where: () => chainableRows(rows) }),
  }));
}

/**
 * Configure db.update().set().where() to resolve to the given rows, whether
 * or not the call chain ends with `.returning()`. `bindPilotOrganization`'s
 * write uses `.returning()`; `rebindPilotOrganization`'s write does not
 * (round 21) — both need to resolve correctly against the same mock.
 */
function dbUpdateReturns(rows: unknown[]) {
  mockDbUpdate.mockImplementation(() => ({
    set: () => ({
      where: () => {
        const result = Promise.resolve(rows);
        (result as unknown as { returning: () => Promise<unknown[]> }).returning = () => Promise.resolve(rows);
        return result;
      },
    }),
  }));
}

/**
 * Queue up a sequence of one-time `db.select()` results consumed in call
 * order (PR #752 round 21/22). `bindPilotOrganization`/
 * `rebindPilotOrganization` now issue MULTIPLE selects per invocation
 * (organization existence, pilot lookup with `.limit().for('update')`, and
 * — for rebind — up to three financial-artifact-census selects), so a
 * single shared `dbReturns(...)` implementation is no longer precise enough
 * to distinguish them.
 */
function dbSelectSequence(...rowsList: unknown[][]) {
  for (const rows of rowsList) {
    mockDbSelect.mockImplementationOnce(() => ({
      from: () => ({ where: () => chainableRows(rows) }),
    }));
  }
}

function makeNextContext(id?: string) {
  return { params: Promise.resolve(id === undefined ? {} : { id }) };
}

/* ── tests ──────────────────────────────────────────────────────────── */

describe('pilot-ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockCalls = [];
  });

  describe('getPilotClaimedOrganizationId', () => {
    it('reads responses.organizationId when present', () => {
      expect(getPilotClaimedOrganizationId(pilotOwnedByA)).toBe(ORG_A);
    });

    it('trims surrounding whitespace', () => {
      expect(getPilotClaimedOrganizationId({ responses: { organizationId: `  ${ORG_B}  ` } })).toBe(ORG_B);
    });

    it('returns null when responses is missing, empty, or non-string (fail closed)', () => {
      expect(getPilotClaimedOrganizationId(pilotNoOwner)).toBeNull();
      expect(getPilotClaimedOrganizationId({ responses: null })).toBeNull();
      expect(getPilotClaimedOrganizationId({})).toBeNull();
      expect(getPilotClaimedOrganizationId(null)).toBeNull();
      expect(getPilotClaimedOrganizationId({ responses: { organizationId: '' } })).toBeNull();
      expect(getPilotClaimedOrganizationId({ responses: { organizationId: '   ' } })).toBeNull();
      expect(getPilotClaimedOrganizationId({ responses: { organizationId: 123 as unknown as string } })).toBeNull();
    });
  });

  describe('authorizePilotAccess — allow/deny matrix', () => {
    it('1. same-org steward is allowed', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      const decision = await authorizePilotAccess(ORG_A);
      expect(decision).toEqual({ ok: true, reason: 'same-org', actorOrganizationId: ORG_A });
    });

    it('2. cross-org steward is denied (403)', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      const decision = await authorizePilotAccess(ORG_B);
      expect(decision).toEqual({ ok: false, status: 403, reason: 'cross-org' });
    });

    it('3. officer acting on a pilot they do not own is denied (403)', async () => {
      mockGetCurrentUser.mockResolvedValue(officerOfA);
      const decision = await authorizePilotAccess(ORG_B);
      expect(decision).toEqual({ ok: false, status: 403, reason: 'cross-org' });
    });

    it('4a. platform system_admin is allowed across orgs', async () => {
      mockGetCurrentUser.mockResolvedValue(systemAdmin);
      const decision = await authorizePilotAccess(ORG_B);
      expect(decision).toMatchObject({ ok: true, reason: 'platform' });
    });

    it('4b. platform app_owner is allowed across orgs even with no org context', async () => {
      mockGetCurrentUser.mockResolvedValue(appOwner);
      const decision = await authorizePilotAccess(ORG_B);
      expect(decision).toMatchObject({ ok: true, reason: 'platform' });
    });

    it('4c. org-level admin (140) is NOT a platform actor and stays org-scoped (cross-org denied)', async () => {
      mockGetCurrentUser.mockResolvedValue(adminOfA);
      const denied = await authorizePilotAccess(ORG_B);
      expect(denied).toEqual({ ok: false, status: 403, reason: 'cross-org' });
      // …and an org-level admin acting within their own org is allowed.
      const allowed = await authorizePilotAccess(ORG_A);
      expect(allowed).toEqual({ ok: true, reason: 'same-org', actorOrganizationId: ORG_A });
    });

    it('5a. actor with no org context is denied (fail closed)', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardNoOrg);
      const decision = await authorizePilotAccess(ORG_A);
      expect(decision).toEqual({ ok: false, status: 403, reason: 'actor-missing-org-context' });
    });

    it('5b. pilot with no owner org is denied for org-scoped actors (fail closed)', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      const decision = await authorizePilotAccess(null);
      expect(decision).toEqual({ ok: false, status: 403, reason: 'pilot-missing-org-context' });
    });

    it('7. unauthenticated actor is denied (401)', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const decision = await authorizePilotAccess(ORG_A);
      expect(decision).toEqual({ ok: false, status: 401, reason: 'unauthenticated' });
    });

    it('platform threshold is the system_admin level (200), above org-level executives', () => {
      expect(PILOT_PLATFORM_ACCESS_MIN_LEVEL).toBe(200);
    });
  });

  describe('enforcePilotOwnership — HTTP shaping', () => {
    it('returns null (proceed) when access is allowed', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      expect(await enforcePilotOwnership(pilotOwnedByA)).toBeNull();
    });

    it('returns a 403 response on cross-org access', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      const res = await enforcePilotOwnership(pilotOwnedByB);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
      await expect(res!.json()).resolves.toEqual({ error: 'Forbidden' });
    });

    it('returns a 401 response when unauthenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      const res = await enforcePilotOwnership(pilotOwnedByA);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
      await expect(res!.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    it('round 23: after a rebind, the ORIGINAL claimed org no longer passes — the NEW verified org does', async () => {
      // Pilot claims Org A but was verified/rebound to Org B.
      const reboundPilot = { responses: { organizationId: ORG_A }, verifiedOrganizationId: ORG_B };

      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      const deniedForA = await enforcePilotOwnership(reboundPilot);
      expect(deniedForA).not.toBeNull();
      expect(deniedForA!.status).toBe(403);

      const stewardOfB = { id: 'u-steward-b', organizationId: ORG_B, role: 'steward' };
      mockGetCurrentUser.mockResolvedValue(stewardOfB);
      expect(await enforcePilotOwnership(reboundPilot)).toBeNull();
    });
  });

  describe('withPilotOwnership — factory item-route wrapper', () => {
    it('delegates to the handler when same-org access is allowed', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      dbReturns([pilotOwnedByA]);
      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const wrapped = withPilotOwnership(handler);

      const res = await wrapped(new Request('http://localhost/api/pilot/apply/p1') as never, makeNextContext('p1'));
      expect(res.status).toBe(200);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('blocks cross-org access with 403 and never calls the handler', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      dbReturns([pilotOwnedByB]);
      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const wrapped = withPilotOwnership(handler);

      const res = await wrapped(new Request('http://localhost/api/pilot/apply/p1') as never, makeNextContext('p1'));
      expect(res.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 404 (not a permission leak) when the pilot application is missing', async () => {
      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      dbReturns([]);
      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const wrapped = withPilotOwnership(handler);

      const res = await wrapped(new Request('http://localhost/api/pilot/apply/missing') as never, makeNextContext('missing'));
      expect(res.status).toBe(404);
      expect(handler).not.toHaveBeenCalled();
    });

    it('delegates to the handler (its own 400) when no id param is present', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }));
      const wrapped = withPilotOwnership(handler);

      const res = await wrapped(new Request('http://localhost/api/pilot/apply') as never, makeNextContext(undefined));
      expect(res.status).toBe(400);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('round 23: uses the effective owner — a rebind moves access, the original claimed org no longer passes', async () => {
      const reboundRow = { responses: { organizationId: ORG_A }, verifiedOrganizationId: ORG_B };

      mockGetCurrentUser.mockResolvedValue(stewardOfA);
      dbReturns([reboundRow]);
      const handlerForA = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const deniedRes = await withPilotOwnership(handlerForA)(new Request('http://localhost/api/pilot/apply/p1') as never, makeNextContext('p1'));
      expect(deniedRes.status).toBe(403);
      expect(handlerForA).not.toHaveBeenCalled();

      const stewardOfB = { id: 'u-steward-b', organizationId: ORG_B, role: 'steward' };
      mockGetCurrentUser.mockResolvedValue(stewardOfB);
      dbReturns([reboundRow]);
      const handlerForB = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const allowedRes = await withPilotOwnership(handlerForB)(new Request('http://localhost/api/pilot/apply/p1') as never, makeNextContext('p1'));
      expect(allowedRes.status).toBe(200);
      expect(handlerForB).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPilotVerifiedOrganizationId (PR #752 round 20)', () => {
    it('reads verifiedOrganizationId when present', () => {
      expect(getPilotVerifiedOrganizationId({ verifiedOrganizationId: ORG_A })).toBe(ORG_A);
    });

    it('returns null when verifiedOrganizationId is missing, empty, or non-string (fail closed)', () => {
      expect(getPilotVerifiedOrganizationId({ verifiedOrganizationId: null })).toBeNull();
      expect(getPilotVerifiedOrganizationId({ verifiedOrganizationId: '' })).toBeNull();
      expect(getPilotVerifiedOrganizationId({})).toBeNull();
      expect(getPilotVerifiedOrganizationId(null)).toBeNull();
    });

    it('is independent of the claimed organization — a claim never satisfies verification', () => {
      const application = { responses: { organizationId: ORG_A }, verifiedOrganizationId: null };
      expect(getPilotClaimedOrganizationId(application)).toBe(ORG_A);
      expect(getPilotVerifiedOrganizationId(application)).toBeNull();
    });
  });

  describe('getPilotEffectiveOrganizationId (PR #752 round 23)', () => {
    it('prefers the verified organization over the claim when both are present', () => {
      const application = { responses: { organizationId: ORG_A }, verifiedOrganizationId: ORG_B };
      expect(getPilotEffectiveOrganizationId(application)).toBe(ORG_B);
    });

    it('falls back to the claim when no verified organization exists yet', () => {
      const application = { responses: { organizationId: ORG_A }, verifiedOrganizationId: null };
      expect(getPilotEffectiveOrganizationId(application)).toBe(ORG_A);
    });

    it('returns null when neither a verified organization nor a claim exists (fail closed)', () => {
      expect(getPilotEffectiveOrganizationId({ responses: {}, verifiedOrganizationId: null })).toBeNull();
      expect(getPilotEffectiveOrganizationId(null)).toBeNull();
    });

    it('reflects a rebind: the ORIGINAL claimed org no longer wins once verification points elsewhere', () => {
      // Pilot originally claimed Org A, was verified, then platform rebound it to Org B.
      const rebound = { responses: { organizationId: ORG_A }, verifiedOrganizationId: ORG_B };
      expect(getPilotEffectiveOrganizationId(rebound)).toBe(ORG_B);
      expect(getPilotEffectiveOrganizationId(rebound)).not.toBe(ORG_A);
    });
  });

  describe('bindPilotOrganization (PR #752 round 20/21)', () => {
    it('binds the pilot to the target organization when unbound and it exists', async () => {
      dbSelectSequence([{ id: ORG_B }], [{ verifiedOrganizationId: null }]);
      dbUpdateReturns([{ id: 'pilot-1' }]);

      const result = await bindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
      });

      expect(result).toEqual({ ok: true, organizationId: ORG_B });
      expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    });

    it('round 22: locks the pilot row with SELECT ... FOR UPDATE before reading/writing verifiedOrganizationId (concurrency hardening)', async () => {
      dbSelectSequence([{ id: ORG_B }], [{ verifiedOrganizationId: null }]);
      dbUpdateReturns([{ id: 'pilot-1' }]);

      await bindPilotOrganization({ pilotId: 'pilot-1', organizationId: ORG_B, verifiedBy: 'u-sysadmin' });

      expect(lockCalls).toContainEqual({ limit: 1, mode: 'update' });
    });

    it('fails closed (404) when the target organization does not exist — a claim that was never real can never become verified', async () => {
      dbSelectSequence([]);
      dbUpdateReturns([{ id: 'pilot-1' }]);

      const result = await bindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: 'org-does-not-exist',
        verifiedBy: 'u-sysadmin',
      });

      expect(result).toEqual({ ok: false, status: 404, error: 'Organization not found' });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('fails closed (409) when the pilot application does not exist', async () => {
      dbSelectSequence([{ id: ORG_B }], []);
      dbUpdateReturns([]);

      const result = await bindPilotOrganization({
        pilotId: 'pilot-missing',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
      });

      expect(result).toEqual({ ok: false, status: 409, error: 'Pilot application not found' });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('round 21: re-binding to the SAME organization is idempotent — succeeds without writing again', async () => {
      dbSelectSequence([{ id: ORG_B }], [{ verifiedOrganizationId: ORG_B }]);

      const result = await bindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin-2',
      });

      expect(result).toEqual({ ok: true, organizationId: ORG_B });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('round 21: re-binding to a DIFFERENT organization is rejected with 409 — verification is immutable, not a freely-editable field', async () => {
      dbSelectSequence([{ id: ORG_A }], [{ verifiedOrganizationId: ORG_B }]);

      const result = await bindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_A,
        verifiedBy: 'u-sysadmin',
      });

      expect(result.ok).toBe(false);
      expect((result as { status: number }).status).toBe(409);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });

  describe('rebindPilotOrganization (PR #752 round 21) — audited correction flow', () => {
    it('rejects with 409 when reason is blank (fails closed even if the caller skips zod validation)', async () => {
      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: '   ',
      });

      expect(result).toEqual({
        ok: false,
        status: 409,
        error: "A non-empty reason is required to rebind a pilot application's verified organization.",
      });
      expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it('fails closed (404) when the target organization does not exist', async () => {
      dbSelectSequence([]);

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: 'org-does-not-exist',
        verifiedBy: 'u-sysadmin',
        reason: 'Correcting a misfiled claim after manual verification.',
      });

      expect(result).toEqual({ ok: false, status: 404, error: 'Organization not found' });
    });

    it('fails closed (409) when the pilot application does not exist', async () => {
      dbSelectSequence([{ id: ORG_B }], []);

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-missing',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Correcting a misfiled claim after manual verification.',
      });

      expect(result).toEqual({ ok: false, status: 409, error: 'Pilot application not found' });
    });

    it('fails closed (409) when the pilot is not yet bound — rebind presupposes an existing binding', async () => {
      dbSelectSequence([{ id: ORG_B }], [{ verifiedOrganizationId: null }]);

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Correcting a misfiled claim after manual verification.',
      });

      expect(result).toEqual({
        ok: false,
        status: 409,
        error:
          'This pilot application is not yet bound to any organization; use bindPilotOrganization (verify-organization) instead of rebind.',
      });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('is idempotent when the target organization matches the current binding', async () => {
      dbSelectSequence([{ id: ORG_A }], [{ verifiedOrganizationId: ORG_A }]);

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_A,
        verifiedBy: 'u-sysadmin',
        reason: 'Re-confirming the existing binding.',
      });

      expect(result).toEqual({ ok: true, organizationId: ORG_A, previousOrganizationId: ORG_A });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('blocks the rebind with 409 when a financial artifact already exists', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [{ id: 'contract-1' }],
      );

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B.',
      });

      expect(result.ok).toBe(false);
      expect((result as { status: number }).status).toBe(409);
      expect((result as { error: string }).error).toMatch(/financial artifacts/i);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('round 27: blocks the rebind with 409 with NO override possible — the acknowledgeFinancialArtifacts escape hatch was removed entirely', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [{ id: 'contract-1' }],
      );

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B. Financial rows will be corrected manually.',
      });

      expect(result.ok).toBe(false);
      expect((result as { status: number }).status).toBe(409);
      expect((result as { error: string }).error).toMatch(/not permitted once/i);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('proceeds when no financial artifact exists in any of the 3 tables', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [], // commercialContracts: none
        [], // platformInvoices: none
        [], // orgSubscriptions: none
      );
      dbUpdateReturns([{ id: 'pilot-1' }]);

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B.',
      });

      expect(result).toEqual({ ok: true, organizationId: ORG_B, previousOrganizationId: ORG_A });
    });

    it('round 22: blocks the rebind when a platform invoice exists with NO commercial contract (invoice_issued can happen independently of contract_sent)', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [], // commercialContracts: none
        [{ id: 'invoice-1' }], // platformInvoices: found
      );

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B.',
      });

      expect(result.ok).toBe(false);
      expect((result as { status: number }).status).toBe(409);
      expect((result as { error: string }).error).toMatch(/financial artifacts/i);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('round 22: blocks the rebind when an org subscription exists with NO contract or invoice (subscription_active can happen independently)', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [], // commercialContracts: none
        [], // platformInvoices: none
        [{ id: 'subscription-1' }], // orgSubscriptions: found
      );

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B.',
      });

      expect(result.ok).toBe(false);
      expect((result as { status: number }).status).toBe(409);
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });

    it('round 22: locks the pilot row with SELECT ... FOR UPDATE before checking financial artifacts (concurrency hardening)', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [],
        [],
        [],
      );
      dbUpdateReturns([{ id: 'pilot-1' }]);

      await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B.',
      });

      expect(lockCalls).toContainEqual({ limit: 1, mode: 'update' });
    });

    it('round 26: clears previously approved commercial terms when the verified organization actually changes', async () => {
      dbSelectSequence(
        [{ id: ORG_B }],
        [{ verifiedOrganizationId: ORG_A }],
        [],
        [],
        [],
      );
      const setCalls: Array<Record<string, unknown>> = [];
      mockDbUpdate.mockImplementation(() => ({
        set: (values: Record<string, unknown>) => {
          setCalls.push(values);
          return { where: () => Promise.resolve([{ id: 'pilot-1' }]) };
        },
      }));

      await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_B,
        verifiedBy: 'u-sysadmin',
        reason: 'Org A was a data-entry mistake; the real org is Org B.',
      });

      expect(setCalls).toHaveLength(1);
      expect(setCalls[0]).toMatchObject({
        verifiedOrganizationId: ORG_B,
        verifiedMemberCount: null,
        verifiedPilotAmount: null,
        verifiedSubscriptionPlanId: null,
        commercialTermsApprovedBy: null,
        commercialTermsApprovedAt: null,
      });
    });

    it('round 26: does NOT clear commercial terms for the idempotent same-org no-op path', async () => {
      dbSelectSequence([{ id: ORG_A }], [{ verifiedOrganizationId: ORG_A }]);

      const result = await rebindPilotOrganization({
        pilotId: 'pilot-1',
        organizationId: ORG_A,
        verifiedBy: 'u-sysadmin',
        reason: 'Re-confirming the existing binding.',
      });

      expect(result).toEqual({ ok: true, organizationId: ORG_A, previousOrganizationId: ORG_A });
      expect(mockDbUpdate).not.toHaveBeenCalled();
    });
  });
});
