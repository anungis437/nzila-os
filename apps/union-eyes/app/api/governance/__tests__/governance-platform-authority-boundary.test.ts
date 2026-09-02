/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 11: golden_shares/mission_audits/reserved_matter_votes are
 * platform-wide, non-tenant-shaped Class-B governance tables (see
 * db/schema/domains/governance/governance.ts) executed entirely under
 * withSystemContext with NO organization_id filter — but were previously
 * gated only by `auth: { minRole: 'admin' }`, an ORDINARY per-organization
 * role tier (level 140, "Local Union Executive" per
 * lib/api-auth-guard.ts's ROLE_HIERARCHY) far below the national/platform
 * tiers (clc_staff 180, clc_executive 190, system_admin 200) — meaning any
 * tenant's own org-admin could read/mutate this platform-wide governance
 * data. This is the Org A / Org B negative proof: exercises the REAL
 * withApi() role-enforcement mechanism (not mocked) against the exact
 * `auth: { roles: [...] }` config now used by
 * app/api/governance/golden-share/route.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockGetCurrentUser } = vi.hoisted(() => ({ mockGetCurrentUser: vi.fn() }));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: mockGetCurrentUser };
});
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { mockExecute, mockWithSystemContext } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockWithSystemContext: vi.fn(),
}));
vi.mock('@/db/db', () => ({ db: { execute: mockExecute } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: mockWithSystemContext }));

function makeUser(role: string, organizationId = 'org-a') {
  return { id: 'usr-1', email: 't@example.com', role, organizationId };
}

async function loadGoldenShareRoute() {
  return import('../golden-share/route');
}

describe('governance platform-authority boundary (PR #752 round 11 — real withApi, no mocked auth wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithSystemContext.mockImplementation(async (fn: (tx?: unknown) => unknown) => fn({}));
    mockExecute.mockResolvedValue([{ id: 'share_1' }]);
  });

  it("rejects an ordinary tenant org-admin (role 'admin', Org A) with 403 — never reaches SYSTEM_ONLY data", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('admin', 'org-a'));
    const { GET } = await loadGoldenShareRoute();

    const res = await GET(new NextRequest('http://localhost/api/governance/golden-share'));

    expect(res.status).toBe(403);
    expect(mockWithSystemContext).not.toHaveBeenCalled();
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejects an ordinary member (role 'member', Org B) with 403", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('member', 'org-b'));
    const { GET } = await loadGoldenShareRoute();

    const res = await GET(new NextRequest('http://localhost/api/governance/golden-share'));

    expect(res.status).toBe(403);
    expect(mockWithSystemContext).not.toHaveBeenCalled();
  });

  it("allows clc_staff through to the SYSTEM_ONLY data path", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('clc_staff', 'org-a'));
    const { GET } = await loadGoldenShareRoute();

    const res = await GET(new NextRequest('http://localhost/api/governance/golden-share'));

    expect(res.status).toBe(200);
    expect(mockWithSystemContext).toHaveBeenCalled();
  });

  it("allows system_admin through to the SYSTEM_ONLY data path", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('system_admin', 'org-a'));
    const { GET } = await loadGoldenShareRoute();

    const res = await GET(new NextRequest('http://localhost/api/governance/golden-share'));

    expect(res.status).toBe(200);
    expect(mockWithSystemContext).toHaveBeenCalled();
  });

  it("allows clc_executive through to the SYSTEM_ONLY data path", async () => {
    mockGetCurrentUser.mockResolvedValue(makeUser('clc_executive', 'org-a'));
    const { GET } = await loadGoldenShareRoute();

    const res = await GET(new NextRequest('http://localhost/api/governance/golden-share'));

    expect(res.status).toBe(200);
    expect(mockWithSystemContext).toHaveBeenCalled();
  });
});
