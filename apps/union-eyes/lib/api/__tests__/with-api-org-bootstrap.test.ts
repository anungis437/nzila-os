/**
 * withApi() org-resolution bootstrap — Phase G remediation regression.
 *
 * Guards the fix for the RLS org-resolution bootstrap deadlock: `withApi` must
 * resolve the caller's organization inside a transaction-local user-identity
 * RLS context (the `withRLSContext` `{ organizationId: 'system' }` sentinel)
 * so the user-scoped membership policy (`user_id = app.current_user_id`) is
 * satisfied. A null/failed resolution must preserve the auth-validated
 * organization (no spurious 403), and a request with no org anywhere must still
 * fail closed.
 *
 * Reproduction context: on the pre-fix implementation `getOrganizationIdForUser`
 * ran on a context-less pooled connection, so under forced RLS the user-scoped
 * membership read returned zero rows → falsy org → 403 "Organization context
 * required" for every authenticated identity.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetCurrentUser,
  mockGetOrganizationIdForUser,
  mockWithRLSContext,
  mockCheckRateLimit,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetOrganizationIdForUser: vi.fn(),
  mockWithRLSContext: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: mockGetCurrentUser };
});
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: mockGetOrganizationIdForUser,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mockWithRLSContext }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { withApi } from '../with-api';

function makeRequest(url = 'http://localhost:3000/api/test', options?: RequestInit) {
  return new NextRequest(new URL(url), options);
}

describe('withApi() org-resolution bootstrap (Phase G remediation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The real withRLSContext establishes app.current_user_id transaction-locally
    // then runs the callback; the mock invokes the callback to simulate that the
    // identity context is present when getOrganizationIdForUser reads membership.
    mockWithRLSContext.mockImplementation(async (_ctx: unknown, op: (tx: unknown) => unknown) => op({}));
  });

  it('resolves org inside the user-identity system bootstrap context', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1', email: 'a@b.c', role: 'member', organizationId: null });
    mockGetOrganizationIdForUser.mockResolvedValue('org-resolved');

    let seenOrg: string | null = 'unset';
    const handler = withApi({}, async (ctx) => {
      seenOrg = ctx.organizationId;
      return { ok: true };
    });
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    // Bootstrap context established with the 'system' sentinel (user set, org cleared)…
    expect(mockWithRLSContext).toHaveBeenCalledWith({ organizationId: 'system' }, expect.any(Function));
    // …and org resolution ran inside it, for the authenticated identity.
    expect(mockGetOrganizationIdForUser).toHaveBeenCalledWith('u1');
    expect(seenOrg).toBe('org-resolved');
  });

  it('preserves the auth-validated org when resolution returns null (no spurious 403)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u2', email: 'a@b.c', role: 'member', organizationId: 'org-auth' });
    mockGetOrganizationIdForUser.mockResolvedValue(null);

    let seenOrg: string | null = 'unset';
    const handler = withApi({}, async (ctx) => {
      seenOrg = ctx.organizationId;
      return { ok: true };
    });
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    expect(seenOrg).toBe('org-auth');
  });

  it('fails closed with 403 when neither auth nor resolution yields an org', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u3', email: 'a@b.c', role: 'member', organizationId: null });
    mockGetOrganizationIdForUser.mockResolvedValue(null);

    const handler = withApi({}, async () => ({ ok: true }));
    const res = await handler(makeRequest());

    expect(res.status).toBe(403);
  });

  it('keeps the auth org when the bootstrap context throws (fail-safe fallback)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u4', email: 'a@b.c', role: 'member', organizationId: 'org-fallback' });
    mockWithRLSContext.mockRejectedValue(new Error('no auth context'));

    let seenOrg: string | null = 'unset';
    const handler = withApi({}, async (ctx) => {
      seenOrg = ctx.organizationId;
      return { ok: true };
    });
    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    expect(seenOrg).toBe('org-fallback');
  });
});
