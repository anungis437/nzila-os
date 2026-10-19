/**
 * Organization Middleware — Unit Tests
 *
 * Tests:
 *   - getOrganizationId() cookie extraction
 *   - getOrganizationIdFromRequest() header/cookie/fallback chain
 *   - withOrganizationAuth() guard behaviour
 *
 * Tier 1 — Security Perimeter
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: (...a: any[]) => mockCookieGet(...a) }),
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body: any, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: vi.fn(),
  validateOrganizationExists: vi.fn(),
  userHasOrganizationAccess: vi.fn(),
  getUserRoleInOrganization: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  requireUser: vi.fn(),
  requireUserForOrganization: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (ctxOrOp: any, op?: any) => {
    const operation = typeof ctxOrOp === 'function' ? ctxOrOp : op;
    return operation();
  }),
}));

vi.mock('@nzila/os-core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

const mockCanonicalEnabled = vi.hoisted(() => vi.fn(() => false));
const mockCanonicalContext = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/canonical-bootstrap', () => ({
  currentStateContextEnabled: mockCanonicalEnabled,
}));
vi.mock('@/lib/auth/canonical-context', () => ({
  getCanonicalOrganizationContext: mockCanonicalContext,
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  getOrganizationId,
  getOrganizationIdFromRequest,
  validateOrganizationAccess,
  withOrganizationAuth,
} from '../organization-middleware';
import {
  getOrganizationIdForUser,
  getUserRoleInOrganization,
  userHasOrganizationAccess,
  validateOrganizationExists,
} from '@/lib/organization-utils';
import { requireUser, requireUserForOrganization } from '@/lib/api-auth-guard';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { NextRequest, NextResponse } from 'next/server';

const mockGetOrgIdForUser = vi.mocked(getOrganizationIdForUser);
const mockValidateOrgExists = vi.mocked(validateOrganizationExists);
const mockUserHasAccess = vi.mocked(userHasOrganizationAccess);
const mockGetUserRole = vi.mocked(getUserRoleInOrganization);

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const mockRequireUser = vi.mocked(requireUser);
const mockRequireUserForOrg = vi.mocked(requireUserForOrganization);
const mockWithRLS = vi.mocked(withRLSContext);

// ─── getOrganizationId ───────────────────────────────────────────────────────

describe('getOrganizationId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns selected_org_id cookie value', async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === 'selected_org_id' ? { value: 'org-uuid-1' } : undefined,
    );
    const id = await getOrganizationId();
    expect(id).toBe('org-uuid-1');
  });

  it('falls back to selected_organization_id cookie', async () => {
    mockCookieGet.mockImplementation((name: string) =>
      name === 'selected_organization_id' ? { value: 'org-uuid-2' } : undefined,
    );
    const id = await getOrganizationId();
    expect(id).toBe('org-uuid-2');
  });

  it('returns null when no cookie is set', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const id = await getOrganizationId();
    expect(id).toBeNull();
  });
});

// ─── getOrganizationIdFromRequest ────────────────────────────────────────────

describe('getOrganizationIdFromRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookieGet.mockReturnValue(undefined);
    mockUserHasAccess.mockResolvedValue(true);
  });

  function fakeRequest(headers: Record<string, string> = {}) {
    return {
      headers: {
        get: (name: string) => headers[name] ?? null,
      },
    } as any as NextRequest;
  }

  it('resolves from X-Org-ID header first', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    const req = fakeRequest({ 'X-Org-ID': 'org-from-header' });

    const id = await getOrganizationIdFromRequest(req, 'user_1');
    expect(id).toBe('org-from-header');
  });

  it('falls back to X-Organization-ID header', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    const req = fakeRequest({ 'X-Organization-ID': 'org-legacy-header' });

    const id = await getOrganizationIdFromRequest(req, 'user_1');
    expect(id).toBe('org-legacy-header');
  });

  it('falls back to selected_org_id cookie', async () => {
    mockValidateOrgExists.mockImplementation(async (orgId) =>
      orgId === 'org-cookie-1',
    );
    mockCookieGet.mockImplementation((name: string) =>
      name === 'selected_org_id' ? { value: 'org-cookie-1' } : undefined,
    );
    const req = fakeRequest();

    const id = await getOrganizationIdFromRequest(req, 'user_1');
    expect(id).toBe('org-cookie-1');
  });

  it('falls back to user default when all else fail', async () => {
    mockValidateOrgExists.mockResolvedValue(false);
    mockGetOrgIdForUser.mockResolvedValue('org-user-default');
    const req = fakeRequest();

    const id = await getOrganizationIdFromRequest(req, 'user_1');
    expect(id).toBe('org-user-default');
    expect(mockGetOrgIdForUser).toHaveBeenCalledWith('user_1');
  });

  it('skips invalid org IDs', async () => {
    // First two headers are invalid
    mockValidateOrgExists
      .mockResolvedValueOnce(false) // X-Org-ID invalid
      .mockResolvedValueOnce(true);  // X-Organization-ID valid
    const req = fakeRequest({
      'X-Org-ID': 'bad-org',
      'X-Organization-ID': 'good-org',
    });

    const id = await getOrganizationIdFromRequest(req, 'user_1');
    expect(id).toBe('good-org');
    expect(mockUserHasAccess).toHaveBeenCalledWith('user_1', 'good-org');
  });

  it('ignores a forged header naming an existing organization the user does not belong to', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockUserHasAccess.mockImplementation(async (_userId: string, orgId: string) => orgId === ORG_A);
    mockGetOrgIdForUser.mockResolvedValue(ORG_A);
    const req = fakeRequest({ 'X-Org-ID': ORG_B });

    const id = await getOrganizationIdFromRequest(req, 'user-steward-a');
    expect(id).toBe(ORG_A);
    expect(mockGetOrgIdForUser).toHaveBeenCalledWith('user-steward-a');
  });

  it('ignores a forged organization cookie and keeps an authorized header', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockUserHasAccess.mockImplementation(async (_userId: string, orgId: string) => orgId === ORG_A);
    mockCookieGet.mockImplementation((name: string) =>
      name === 'selected_org_id' ? { value: ORG_B } : undefined,
    );
    const req = fakeRequest({ 'X-Org-ID': ORG_A });

    const id = await getOrganizationIdFromRequest(req, 'user-steward-a');
    expect(id).toBe(ORG_A);
    expect(mockGetOrgIdForUser).not.toHaveBeenCalled();
  });

  it('keeps the higher-precedence membership when header and cookie name different authorized organizations', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockUserHasAccess.mockResolvedValue(true);
    mockCookieGet.mockImplementation((name: string) =>
      name === 'selected_org_id' ? { value: ORG_B } : undefined,
    );
    const req = fakeRequest({ 'X-Org-ID': ORG_A });

    const id = await getOrganizationIdFromRequest(req, 'user-steward-a');
    expect(id).toBe(ORG_A);
  });

  it('still accepts a legacy tenant header when the user is a member and no newer signal is authorized', async () => {
    mockValidateOrgExists.mockImplementation(async (orgId: string) => orgId === ORG_A);
    mockUserHasAccess.mockImplementation(async (_userId: string, orgId: string) => orgId === ORG_A);
    const req = fakeRequest({ 'X-Org-ID': ORG_B, 'X-Tenant-ID': ORG_A });

    const id = await getOrganizationIdFromRequest(req, 'user-steward-a');
    expect(id).toBe(ORG_A);
  });

  it('does not accept a client organization signal when authentication is missing', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockGetOrgIdForUser.mockRejectedValue(new Error('No verified organization membership'));
    const req = fakeRequest({ 'X-Org-ID': ORG_A });

    await expect(getOrganizationIdFromRequest(req, '')).rejects.toThrow(
      'No verified organization membership',
    );
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });
});

describe('validateOrganizationAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a principal who is a member of the requested organization', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockUserHasAccess.mockResolvedValue(true);
    mockGetUserRole.mockResolvedValue('steward');

    await expect(validateOrganizationAccess('user-steward-a', ORG_A)).resolves.toBe(true);
    expect(mockGetUserRole).toHaveBeenCalledWith('user-steward-a', ORG_A);
  });

  it('denies another existing organization when the principal is only an admin elsewhere', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockUserHasAccess.mockResolvedValue(false);
    mockGetUserRole.mockResolvedValue('admin');

    await expect(validateOrganizationAccess('user-admin-a', ORG_B)).resolves.toBe(false);
    expect(mockGetUserRole).not.toHaveBeenCalled();
  });

  it('denies a nonexistent organization identifier', async () => {
    mockValidateOrgExists.mockResolvedValue(false);

    await expect(validateOrganizationAccess('user-steward-a', 'missing-org')).resolves.toBe(false);
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });

  it('denies when membership exists but no role can be resolved', async () => {
    mockValidateOrgExists.mockResolvedValue(true);
    mockUserHasAccess.mockResolvedValue(true);
    mockGetUserRole.mockResolvedValue(null);

    await expect(validateOrganizationAccess('user-steward-a', ORG_A)).resolves.toBe(false);
  });
});

// ─── withOrganizationAuth ────────────────────────────────────────────────────

describe('withOrganizationAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when user is not authenticated', async () => {
    mockRequireUser.mockRejectedValue(new Error('Unauthorized'));

    const handler = vi.fn();
    const wrapped = withOrganizationAuth(handler);
    const _result = await wrapped({} as NextRequest);

    expect(handler).not.toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 },
    );
  });

  it('calls handler with OrganizationContext on success', async () => {
    mockRequireUser.mockResolvedValue({
      userId: 'user_1',
      organizationId: 'org-1',
    } as any as Awaited<ReturnType<typeof mockRequireUser>>);
    mockGetOrgIdForUser.mockResolvedValue('org-1');
    mockRequireUserForOrg.mockResolvedValue({
      userId: 'user_1',
      organizationId: 'org-1',
      memberId: 'mem-1',
    } as any as Awaited<ReturnType<typeof mockRequireUserForOrg>>);

    const mockResponse = { body: 'ok', status: 200 } as any as NextResponse;
    const handler = vi.fn().mockResolvedValue(mockResponse);
    const wrapped = withOrganizationAuth(handler);

    const _result = await wrapped({} as NextRequest);

    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user_1',
        memberId: 'mem-1',
      }),
      undefined,
    );
  });

  it('resolves org under the system bootstrap context, then runs membership check + handler under the resolved org context', async () => {
    mockRequireUser.mockResolvedValue({ userId: 'user_1' } as any);
    mockGetOrgIdForUser.mockResolvedValue('org-1');
    mockRequireUserForOrg.mockResolvedValue({
      userId: 'user_1',
      organizationId: 'org-1',
      memberId: 'mem-1',
    } as any);
    const handler = vi.fn().mockResolvedValue({ body: 'ok', status: 200 } as any);

    await withOrganizationAuth(handler)({} as NextRequest);

    // Bootstrap: org is resolved under the identity-only 'system' context so the
    // user-scoped membership read succeeds before an active org is known.
    expect(mockWithRLS).toHaveBeenNthCalledWith(1, { organizationId: 'system' }, expect.any(Function));
    // Then membership verification + handler run under the resolved org context.
    expect(mockWithRLS).toHaveBeenNthCalledWith(2, { organizationId: 'org-1' }, expect.any(Function));
  });
});

describe('withOrganizationAuth canonical V2 execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanonicalEnabled.mockReturnValue(true);
    mockRequireUser.mockResolvedValue({ userId: 'user_1' } as unknown as Awaited<ReturnType<typeof mockRequireUser>>);
    mockCanonicalContext.mockResolvedValue({ userId: 'user_1', organizationId: 'org-1' });
  });

  it('runs the handler inside the canonical organization RLS transaction and awaits its failures', async () => {
    let insideTransaction = false;
    mockWithRLS.mockImplementationOnce((async (_context: unknown, operation: () => Promise<unknown>) => {
      insideTransaction = true;
      try {
        return await operation();
      } finally {
        insideTransaction = false;
      }
    }) as unknown as typeof withRLSContext);
    const handler = vi.fn(async () => {
      expect(insideTransaction).toBe(true);
      return { body: 'ok', status: 200 } as unknown as NextResponse;
    });

    await withOrganizationAuth(handler)({} as NextRequest);

    expect(mockWithRLS).toHaveBeenCalledTimes(1);
    expect(mockWithRLS).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: 'org-1', userId: 'user_1' }),
      undefined,
    );
    expect(mockRequireUserForOrg).not.toHaveBeenCalled();
  });

  it('maps an entitlement denial to 403 rather than a generic 500', async () => {
    const denial = Object.assign(new Error('Module access denied'), { code: 'ENTITLEMENT_REQUIRED' });
    await withOrganizationAuth(vi.fn().mockRejectedValue(denial))({} as NextRequest);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Module access denied', code: 'ENTITLEMENT_REQUIRED' },
      { status: 403 },
    );
  });

  it('still reports unexpected handler failures as 500 and never invokes the handler without canonical context', async () => {
    mockCanonicalContext.mockRejectedValueOnce(new Error('Forbidden'));
    const handler = vi.fn();
    await withOrganizationAuth(handler)({} as NextRequest);
    expect(handler).not.toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Forbidden - User is not a member of this organization' },
      { status: 403 },
    );

    await withOrganizationAuth(vi.fn().mockRejectedValue(new Error('boom')))({} as NextRequest);
    expect(NextResponse.json).toHaveBeenLastCalledWith(
      { error: 'Internal server error' },
      { status: 500 },
    );
  });
});
