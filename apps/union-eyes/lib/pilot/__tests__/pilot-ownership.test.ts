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

const { mockGetCurrentUser, mockDbSelect } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbSelect: vi.fn(),
}));

// Keep the real api-auth-guard (real ROLE_HIERARCHY + normalizeRole) and only
// override identity resolution — mirrors app/api/members cross-org tests.
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: mockGetCurrentUser };
});

vi.mock('@/db', () => ({ db: { select: mockDbSelect } }));
vi.mock('@/db/db', () => ({ db: { select: mockDbSelect } }));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  authorizePilotAccess,
  getPilotOwnerOrganizationId,
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

/** Configure db.select().from().where() to resolve to the given rows. */
function dbReturns(rows: unknown[]) {
  mockDbSelect.mockImplementation(() => ({
    from: () => ({ where: () => Promise.resolve(rows) }),
  }));
}

function makeNextContext(id?: string) {
  return { params: Promise.resolve(id === undefined ? {} : { id }) };
}

/* ── tests ──────────────────────────────────────────────────────────── */

describe('pilot-ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPilotOwnerOrganizationId', () => {
    it('reads responses.organizationId when present', () => {
      expect(getPilotOwnerOrganizationId(pilotOwnedByA)).toBe(ORG_A);
    });

    it('trims surrounding whitespace', () => {
      expect(getPilotOwnerOrganizationId({ responses: { organizationId: `  ${ORG_B}  ` } })).toBe(ORG_B);
    });

    it('returns null when responses is missing, empty, or non-string (fail closed)', () => {
      expect(getPilotOwnerOrganizationId(pilotNoOwner)).toBeNull();
      expect(getPilotOwnerOrganizationId({ responses: null })).toBeNull();
      expect(getPilotOwnerOrganizationId({})).toBeNull();
      expect(getPilotOwnerOrganizationId(null)).toBeNull();
      expect(getPilotOwnerOrganizationId({ responses: { organizationId: '' } })).toBeNull();
      expect(getPilotOwnerOrganizationId({ responses: { organizationId: '   ' } })).toBeNull();
      expect(getPilotOwnerOrganizationId({ responses: { organizationId: 123 as unknown as string } })).toBeNull();
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
  });
});
