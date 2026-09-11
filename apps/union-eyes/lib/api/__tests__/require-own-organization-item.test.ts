/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 11: cross-tenant IDOR proof for
 * /api/organizations/[id]/sharing-settings and
 * /api/organizations/[id]/access-logs.
 *
 * Both used crudRoutes({ table: organizations, orgScoped: false,
 * itemRoute: true }) — orgScoped auto-filtering looks up an
 * `organizationId` COLUMN on the target table, but the target table here
 * IS `organizations` itself (identity column `id`, no `organizationId`
 * column), so no filter was ever applied: ANY authenticated member could
 * GET any OTHER organization's full row by ID, any steward could PATCH
 * one, and any org's own admin could DELETE (archive) ANY OTHER
 * organization entirely — a real, reachable cross-tenant IDOR (the
 * frontend page app/[locale]/dashboard/settings/sharing/page.tsx calls
 * this route with the caller's OWN organizationId, but the backend never
 * verified the URL id actually belonged to the caller).
 *
 * Fixed: lib/api/require-own-organization-item.ts wraps every handler,
 * requiring the URL's [id] to equal the caller's own organizationId.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: m.getCurrentUser };
});
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));

import { requireOwnOrganizationItem } from '../require-own-organization-item';

function makeReq(url = 'http://localhost/api/organizations/org-b/sharing-settings') {
  return new NextRequest(url);
}

describe('requireOwnOrganizationItem — cross-tenant IDOR guard (PR #752 round 11)', () => {
  const innerHandler = vi.fn(async () => new Response(JSON.stringify({ data: 'secret' }), { status: 200 }));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects Org A's caller requesting Org B's item with 403 and never calls the inner handler", async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'user-org-a' });
    m.getOrganizationIdForUser.mockResolvedValue('org-a');
    const wrapped = requireOwnOrganizationItem('id', innerHandler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({ id: 'org-b' }) });

    expect(res.status).toBe(403);
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it("allows Org A's caller requesting Org A's own item", async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'user-org-a' });
    m.getOrganizationIdForUser.mockResolvedValue('org-a');
    const wrapped = requireOwnOrganizationItem('id', innerHandler);

    const res = await wrapped(
      new NextRequest('http://localhost/api/organizations/org-a/sharing-settings'),
      { params: Promise.resolve({ id: 'org-a' }) },
    );

    expect(res.status).toBe(200);
    expect(innerHandler).toHaveBeenCalledTimes(1);
  });

  it('rejects an unauthenticated caller with 401 before resolving any organization', async () => {
    m.getCurrentUser.mockResolvedValue(null);
    const wrapped = requireOwnOrganizationItem('id', innerHandler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({ id: 'org-b' }) });

    expect(res.status).toBe(401);
    expect(m.getOrganizationIdForUser).not.toHaveBeenCalled();
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it('fails closed (403) when the caller has no resolvable organization at all', async () => {
    m.getCurrentUser.mockResolvedValue({ id: 'orphan-user' });
    m.getOrganizationIdForUser.mockResolvedValue('');
    const wrapped = requireOwnOrganizationItem('id', innerHandler);

    const res = await wrapped(makeReq(), { params: Promise.resolve({ id: 'org-b' }) });

    expect(res.status).toBe(403);
    expect(innerHandler).not.toHaveBeenCalled();
  });
});
