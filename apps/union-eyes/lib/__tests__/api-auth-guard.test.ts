/**
 * API Auth Guard — Unit Tests
 *
 * Comprehensive coverage: ROLE_HIERARCHY, LEGACY_ROLE_MAP, normalizeRole,
 * getCurrentUser, getUserFromRequest, getUserContext, getUserContextForOrganization,
 * requireUser, requireUserForOrganization, requireRole, isSystemAdmin,
 * requireSystemAdmin, requireApiAuth, hasRole, hasRoleInOrganization,
 * getUserRole, withApiAuth, requirePermission, requireRoleLevel, requireScope,
 * canAccessMemberResource, getPrimaryRole, getRolesForScope, getServerSession,
 * requireAuth.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted mocks ────────────────────────────────────────────────── */

const mocks = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockClerkCurrentUser: vi.fn(),
  mockOrgMembersFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockLogPermissionCheck: vi.fn(),
  mockGetMemberRoles: vi.fn(),
  mockGetMemberHighestRoleLevel: vi.fn(),
  mockGetMemberEffectivePermissions: vi.fn(),
  mockIsPublicRoute: vi.fn(),
  mockIsCronRoute: vi.fn(),
  mockCookiesGet: vi.fn(),
}));

/** Recursive chain for db.select chains */
function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.mockAuth,
  currentUser: mocks.mockClerkCurrentUser,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => a),
  and: vi.fn((...a: unknown[]) => a),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mocks.mockCookiesGet })),
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 })),
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
    query: {
      organizationMembers: { findFirst: mocks.mockOrgMembersFindFirst },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', userId: 'userId', organizationId: 'organizationId', role: 'role', status: 'status' },
  organizations: { id: 'id', clerkOrganizationId: 'clerkOrganizationId' },
}));

vi.mock('@/db/schema/domains/member', () => ({
  users: { userId: 'userId', isSystemAdmin: 'isSystemAdmin' },
}));

vi.mock('@/db/queries/enhanced-rbac-queries', () => ({
  getMemberRoles: mocks.mockGetMemberRoles,
  getMemberHighestRoleLevel: mocks.mockGetMemberHighestRoleLevel,
  getMemberEffectivePermissions: mocks.mockGetMemberEffectivePermissions,
  logPermissionCheck: mocks.mockLogPermissionCheck,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../public-routes', () => ({
  PUBLIC_API_ROUTES: [],
  CRON_API_ROUTES: [],
  isPublicRoute: mocks.mockIsPublicRoute,
  isCronRoute: mocks.mockIsCronRoute,
}));

vi.mock('../auth/rbac-server', () => ({
  getUserRole: vi.fn().mockResolvedValue('member'),
}));

vi.mock('../auth/roles', () => ({
  getRoleLevel: vi.fn((role: string) => {
    const levels: Record<string, number> = { app_owner: 300, admin: 95, officer: 60, steward: 50, member: 10 };
    return levels[role] || 0;
  }),
}));

/* ── imports ────────────────────────────────────────────────────────── */

import {
  ROLE_HIERARCHY,
  LEGACY_ROLE_MAP,
  normalizeRole,
  getCurrentUser,
  getUserFromRequest,
  getUserContext,
  getUserContextForOrganization,
  requireUser,
  requireUserForOrganization,
  requireRole,
  isSystemAdmin,
  requireSystemAdmin,
  requireApiAuth,
  hasRole,
  hasRoleInOrganization,
  getUserRole,
  hasMinRole,
  withApiAuth,
  requirePermission,
  requireRoleLevel,
  requireScope,
  canAccessMemberResource,
  getPrimaryRole,
  getRolesForScope,
  getServerSession,
  requireAuth,
  type UserRole,
  type EnhancedRoleContext,
} from '../api-auth-guard';

import { NextRequest, NextResponse } from 'next/server';

/* ── helpers ────────────────────────────────────────────────────────── */

const clerkUser = {
  emailAddresses: [{ emailAddress: 'test@union.org' }],
  fullName: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  imageUrl: 'https://img.example.com/avatar.png',
  publicMetadata: { role: 'steward' },
  privateMetadata: {},
};

const baseMembership = {
  id: 'mem-1',
  userId: 'user_123',
  organizationId: 'org-1',
  role: 'steward',
  status: 'active',
};

function makeEnhancedCtx(overrides: Partial<EnhancedRoleContext> = {}): EnhancedRoleContext {
  return {
    organizationId: 'org-1',
    userId: 'user_123',
    memberId: 'mem-1',
    roles: [],
    highestRoleLevel: 50,
    permissions: ['read:organization'],
    hasPermission: (p: string) => overrides.permissions?.includes(p) ?? p === 'read:organization',
    checkScope: () => true,
    ...overrides,
  };
}

/* ── tests ──────────────────────────────────────────────────────────── */

describe('ApiAuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockAuth.mockResolvedValue({ userId: 'user_123', orgId: null });
    mocks.mockClerkCurrentUser.mockResolvedValue(clerkUser);
    mocks.mockOrgMembersFindFirst.mockResolvedValue(baseMembership);
    mocks.mockSelect.mockReturnValue(chain([]));
    mocks.mockIsPublicRoute.mockReturnValue(false);
    mocks.mockIsCronRoute.mockReturnValue(false);
    mocks.mockCookiesGet.mockReturnValue(undefined);
    mocks.mockGetMemberRoles.mockResolvedValue([]);
    mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(0);
    mocks.mockGetMemberEffectivePermissions.mockResolvedValue([]);
    mocks.mockLogPermissionCheck.mockResolvedValue(undefined);
    process.env.PLATFORM_ADMIN_USER_IDS = '';
  });

  // ── ROLE_HIERARCHY ───────────────────────────────────────────────
  describe('ROLE_HIERARCHY', () => {
    it('has app_owner at top (300) and member at bottom (10)', () => {
      expect(ROLE_HIERARCHY.app_owner).toBe(300);
      expect(ROLE_HIERARCHY.member).toBe(10);
    });

    it('contains all expected tiers', () => {
      expect(ROLE_HIERARCHY).toHaveProperty('cto');
      expect(ROLE_HIERARCHY).toHaveProperty('system_admin');
      expect(ROLE_HIERARCHY).toHaveProperty('clc_executive');
      expect(ROLE_HIERARCHY).toHaveProperty('fed_executive');
      expect(ROLE_HIERARCHY).toHaveProperty('admin');
      expect(ROLE_HIERARCHY).toHaveProperty('president');
      expect(ROLE_HIERARCHY).toHaveProperty('steward');
      expect(ROLE_HIERARCHY).toHaveProperty('health_safety_rep');
    });

    it('maintains strict ordering: admin > steward > member', () => {
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.steward);
      expect(ROLE_HIERARCHY.steward).toBeGreaterThan(ROLE_HIERARCHY.member);
    });

    it('app operations > system admin > local union', () => {
      expect(ROLE_HIERARCHY.app_owner).toBeGreaterThan(ROLE_HIERARCHY.system_admin);
      expect(ROLE_HIERARCHY.system_admin).toBeGreaterThan(ROLE_HIERARCHY.admin);
    });

    it('all values are positive integers', () => {
      for (const [role, level] of Object.entries(ROLE_HIERARCHY)) {
        expect(level, `${role} should be positive`).toBeGreaterThan(0);
        expect(Number.isInteger(level), `${role} should be integer`).toBe(true);
      }
    });

    it('has 33 roles total', () => {
      expect(Object.keys(ROLE_HIERARCHY).length).toBe(33);
    });
  });

  // ── LEGACY_ROLE_MAP ──────────────────────────────────────────────
  describe('LEGACY_ROLE_MAP', () => {
    it('maps legacy names correctly', () => {
      expect(LEGACY_ROLE_MAP.super_admin).toBe('admin');
      expect(LEGACY_ROLE_MAP.guest).toBe('member');
      expect(LEGACY_ROLE_MAP.union_officer).toBe('officer');
      expect(LEGACY_ROLE_MAP.union_steward).toBe('steward');
    });

    it('maps CLC legacy roles', () => {
      expect(LEGACY_ROLE_MAP.congress_staff).toBe('clc_staff');
      expect(LEGACY_ROLE_MAP.federation_staff).toBe('fed_staff');
    });

    it('all mapped values are valid ROLE_HIERARCHY keys', () => {
      for (const [legacy, mapped] of Object.entries(LEGACY_ROLE_MAP)) {
        expect(ROLE_HIERARCHY[mapped as UserRole], `${legacy} → ${mapped}`).toBeDefined();
      }
    });
  });

  // ── normalizeRole ────────────────────────────────────────────────
  describe('normalizeRole', () => {
    it('returns role as-is if in ROLE_HIERARCHY', () => {
      expect(normalizeRole('admin')).toBe('admin');
      expect(normalizeRole('steward')).toBe('steward');
    });

    it('maps legacy roles', () => {
      expect(normalizeRole('super_admin')).toBe('admin');
      expect(normalizeRole('guest')).toBe('member');
    });

    it('defaults to member for unknown roles', () => {
      expect(normalizeRole('unknown')).toBe('member');
      expect(normalizeRole('')).toBe('member');
    });
  });

  // ── getCurrentUser ───────────────────────────────────────────────
  describe('getCurrentUser', () => {
    it('returns null when no userId', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      expect(await getCurrentUser()).toBeNull();
    });

    it('returns null when Clerk user is null', async () => {
      mocks.mockClerkCurrentUser.mockResolvedValue(null);
      expect(await getCurrentUser()).toBeNull();
    });

    it('returns AuthUser with email and role', async () => {
      const user = await getCurrentUser();
      expect(user!.id).toBe('user_123');
      expect(user!.email).toBe('test@union.org');
      expect(user!.role).toBe('steward');
    });

    it('grants app_owner for PLATFORM_ADMIN_USER_IDS', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = 'user_123';
      const user = await getCurrentUser();
      expect(user!.role).toBe('app_owner');
    });

    it('throws on auth system error', async () => {
      mocks.mockAuth.mockRejectedValue(new Error('boom'));
      await expect(getCurrentUser()).rejects.toThrow('Service temporarily unavailable');
    });
  });

  // ── getUserFromRequest ───────────────────────────────────────────
  describe('getUserFromRequest', () => {
    it('delegates to getCurrentUser', async () => {
      const user = await getUserFromRequest({} as NextRequest);
      expect(user!.id).toBe('user_123');
    });
  });

  // ── getUserContext ───────────────────────────────────────────────
  describe('getUserContext', () => {
    it('returns null when no userId', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      expect(await getUserContext()).toBeNull();
    });

    it('returns context from membership', async () => {
      const ctx = await getUserContext();
      expect(ctx!.userId).toBe('user_123');
      expect(ctx!.roles).toContain('steward');
      expect(ctx!.memberId).toBe('mem-1');
    });

    it('returns null when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      mocks.mockClerkCurrentUser.mockResolvedValue({ publicMetadata: {} });
      expect(await getUserContext()).toBeNull();
    });

    it('falls back to platform admin when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      process.env.PLATFORM_ADMIN_USER_IDS = 'user_123';
      const ctx = await getUserContext();
      expect(ctx!.roles).toContain('app_owner');
    });

    it('falls back to Clerk metadata role when no membership and not admin', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      mocks.mockClerkCurrentUser.mockResolvedValue({
        publicMetadata: { role: 'officer' },
      });
      const ctx = await getUserContext();
      expect(ctx!.roles).toContain('officer');
    });
  });

  // ── getUserContextForOrganization ────────────────────────────────
  describe('getUserContextForOrganization', () => {
    it('returns null when no userId', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      expect(await getUserContextForOrganization('org-1')).toBeNull();
    });

    it('returns context for membership', async () => {
      const ctx = await getUserContextForOrganization('org-1');
      expect(ctx!.organizationId).toBe('org-1');
    });

    it('returns null when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      expect(await getUserContextForOrganization('org-1')).toBeNull();
    });

    it('falls back to platform admin', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      process.env.PLATFORM_ADMIN_USER_IDS = 'user_123';
      const ctx = await getUserContextForOrganization('org-1');
      expect(ctx!.roles).toContain('app_owner');
    });

    it('accepts userIdOverride', async () => {
      const ctx = await getUserContextForOrganization('org-1', 'user_456');
      expect(ctx).not.toBeNull();
    });
  });

  // ── requireUser ──────────────────────────────────────────────────
  describe('requireUser', () => {
    it('returns user context when authenticated', async () => {
      const ctx = await requireUser();
      expect(ctx.userId).toBe('user_123');
    });

    it('throws Unauthorized when no userId', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      await expect(requireUser()).rejects.toThrow('Unauthorized');
    });

    it('throws Forbidden when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      mocks.mockClerkCurrentUser.mockResolvedValue({ publicMetadata: {} });
      await expect(requireUser()).rejects.toThrow('Forbidden');
    });
  });

  // ── requireUserForOrganization ───────────────────────────────────
  describe('requireUserForOrganization', () => {
    it('returns context when authorized', async () => {
      const ctx = await requireUserForOrganization('org-1');
      expect(ctx.organizationId).toBe('org-1');
    });

    it('throws Unauthorized when not authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      await expect(requireUserForOrganization('org-1')).rejects.toThrow('Unauthorized');
    });

    it('throws Forbidden when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      await expect(requireUserForOrganization('org-1')).rejects.toThrow('Forbidden');
    });
  });

  // ── requireRole ──────────────────────────────────────────────────
  describe('requireRole', () => {
    it('returns when user has the role', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ ...baseMembership, role: 'admin' });
      const ctx = await requireRole('admin');
      expect(ctx.roles).toContain('admin');
    });

    it('passes for admin even if different role requested', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ ...baseMembership, role: 'admin' });
      const ctx = await requireRole('steward');
      expect(ctx).toBeDefined();
    });

    it('throws Forbidden for insufficient role', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ ...baseMembership, role: 'member' });
      await expect(requireRole('admin')).rejects.toThrow('Forbidden');
    });
  });

  // ── isSystemAdmin ────────────────────────────────────────────────
  describe('isSystemAdmin', () => {
    it('returns true for system admin', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ isSystemAdmin: true }]));
      expect(await isSystemAdmin()).toBe(true);
    });

    it('returns false for non-admin', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ isSystemAdmin: false }]));
      expect(await isSystemAdmin()).toBe(false);
    });

    it('returns false when no userId', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      expect(await isSystemAdmin()).toBe(false);
    });

    it('accepts userIdOverride', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ isSystemAdmin: true }]));
      expect(await isSystemAdmin('other')).toBe(true);
    });

    it('returns false on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('DB'); });
      expect(await isSystemAdmin()).toBe(false);
    });
  });

  // ── requireSystemAdmin ───────────────────────────────────────────
  describe('requireSystemAdmin', () => {
    it('does not throw for system admin', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ isSystemAdmin: true }]));
      await expect(requireSystemAdmin()).resolves.toBeUndefined();
    });

    it('throws for non-admin', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ isSystemAdmin: false }]));
      await expect(requireSystemAdmin()).rejects.toThrow('System administrator');
    });
  });

  // ── requireApiAuth ───────────────────────────────────────────────
  describe('requireApiAuth', () => {
    it('returns context for authenticated user', async () => {
      const ctx = await requireApiAuth();
      expect(ctx.userId).toBe('user_123');
    });

    it('throws when not authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      await expect(requireApiAuth()).rejects.toThrow('Unauthorized');
    });

    it('allows public access when configured', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      const ctx = await requireApiAuth({ allowPublic: true });
      expect(ctx.userId).toBeNull();
    });

    it('checks roles when specified', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ role: 'admin' });
      const ctx = await requireApiAuth({ roles: ['admin'] });
      expect(ctx.role).toBe('admin');
    });

    it('throws when role not matched', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ role: 'member' });
      await expect(requireApiAuth({ roles: ['admin'] })).rejects.toThrow('Forbidden');
    });
  });

  // ── hasRole ──────────────────────────────────────────────────────
  describe('hasRole', () => {
    it('returns true when user meets role hierarchy', async () => {
      expect(await hasRole('member')).toBe(true);
    });

    it('returns false when user is unauthenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      expect(await hasRole('admin')).toBe(false);
    });

    it('returns true for platform admin', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = 'user_123';
      expect(await hasRole('admin')).toBe(true);
    });
  });

  // ── hasRoleInOrganization ────────────────────────────────────────
  describe('hasRoleInOrganization', () => {
    it('returns true when membership has sufficient role', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ role: 'admin' });
      expect(await hasRoleInOrganization('org-1', 'member')).toBe(true);
    });

    it('returns false when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      expect(await hasRoleInOrganization('org-1', 'admin')).toBe(false);
    });

    it('returns false when unauthenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      expect(await hasRoleInOrganization('org-1', 'member')).toBe(false);
    });
  });

  // ── getUserRole ──────────────────────────────────────────────────
  describe('getUserRole', () => {
    it('returns role from membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue({ role: 'steward' });
      expect(await getUserRole('user_123', 'org-1')).toBe('steward');
    });

    it('returns null when no membership', async () => {
      mocks.mockOrgMembersFindFirst.mockResolvedValue(undefined);
      expect(await getUserRole('user_123', 'org-1')).toBeNull();
    });

    it('returns null on error', async () => {
      mocks.mockOrgMembersFindFirst.mockRejectedValue(new Error('DB'));
      expect(await getUserRole('user_123', 'org-1')).toBeNull();
    });
  });

  // ── hasMinRole ───────────────────────────────────────────────────
  describe('hasMinRole', () => {
    it('returns false when unauthenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      expect(await hasMinRole('member')).toBe(false);
    });
  });

  // ── withApiAuth ──────────────────────────────────────────────────
  describe('withApiAuth', () => {
    const mockRequest = {
      nextUrl: { pathname: '/api/test' },
      headers: { get: vi.fn() },
    } as unknown as NextRequest;

    it('calls handler when authenticated', async () => {
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withApiAuth(handler);
      await wrapped(mockRequest, {} as never);
      expect(handler).toHaveBeenCalled();
    });

    it('returns 401 when not authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      const handler = vi.fn();
      const wrapped = withApiAuth(handler);
      const res = await wrapped(mockRequest, {} as never);
      expect(res.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();
    });

    it('skips auth for public routes', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null });
      mocks.mockIsPublicRoute.mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withApiAuth(handler);
      await wrapped(mockRequest, {} as never);
      expect(handler).toHaveBeenCalled();
    });

    it('validates cron secret for cron routes', async () => {
      mocks.mockIsCronRoute.mockReturnValue(true);
      const handler = vi.fn();
      const wrapped = withApiAuth(handler);
      const req = {
        nextUrl: { pathname: '/api/cron/test' },
        headers: { get: vi.fn().mockReturnValue(null) },
      } as unknown as NextRequest;
      const res = await wrapped(req, {} as never);
      expect(res.status).toBe(401);
    });

    it('passes cron route with valid secret', async () => {
      process.env.CRON_SECRET_KEY = 'secret';
      mocks.mockIsCronRoute.mockReturnValue(true);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withApiAuth(handler);
      const req = {
        nextUrl: { pathname: '/api/cron/test' },
        headers: { get: vi.fn().mockReturnValue('secret') },
      } as unknown as NextRequest;
      await wrapped(req, {} as never);
      expect(handler).toHaveBeenCalled();
      delete process.env.CRON_SECRET_KEY;
    });

    it('returns 401 on auth error', async () => {
      mocks.mockAuth.mockRejectedValue(new Error('clerk down'));
      const handler = vi.fn();
      const wrapped = withApiAuth(handler);
      const res = await wrapped(mockRequest, {} as never);
      expect(res.status).toBe(401);
    });
  });

  // ── requirePermission (runtime) ──────────────────────────────────
  describe('requirePermission', () => {
    it('does not throw when permission granted', async () => {
      const ctx = makeEnhancedCtx({ permissions: ['approve_claim'] });
      ctx.hasPermission = (p: string) => p === 'approve_claim';
      await expect(requirePermission(ctx, 'approve_claim')).resolves.toBeUndefined();
    });

    it('throws when permission denied', async () => {
      const ctx = makeEnhancedCtx();
      ctx.hasPermission = () => false;
      await expect(requirePermission(ctx, 'approve_claim')).rejects.toThrow('Permission required');
    });

    it('throws custom message', async () => {
      const ctx = makeEnhancedCtx();
      ctx.hasPermission = () => false;
      await expect(requirePermission(ctx, 'x', 'No access')).rejects.toThrow('No access');
    });
  });

  // ── requireRoleLevel (runtime) ───────────────────────────────────
  describe('requireRoleLevel', () => {
    it('does not throw when level is sufficient', async () => {
      const ctx = makeEnhancedCtx({ highestRoleLevel: 100 });
      await expect(requireRoleLevel(ctx, 50)).resolves.toBeUndefined();
    });

    it('throws when level insufficient', async () => {
      const ctx = makeEnhancedCtx({ highestRoleLevel: 10 });
      await expect(requireRoleLevel(ctx, 50)).rejects.toThrow('Role level');
    });
  });

  // ── requireScope ─────────────────────────────────────────────────
  describe('requireScope', () => {
    it('does not throw when scope matches', () => {
      const ctx = makeEnhancedCtx();
      ctx.checkScope = () => true;
      expect(() => requireScope(ctx, 'department', 'HR')).not.toThrow();
    });

    it('throws when scope does not match', () => {
      const ctx = makeEnhancedCtx();
      ctx.checkScope = () => false;
      expect(() => requireScope(ctx, 'department', 'HR')).toThrow('Scope required');
    });
  });

  // ── canAccessMemberResource ──────────────────────────────────────
  describe('canAccessMemberResource', () => {
    it('allows access to own resource', () => {
      const ctx = makeEnhancedCtx({ memberId: 'mem-1', highestRoleLevel: 10 });
      expect(canAccessMemberResource(ctx, 'mem-1')).toBe(true);
    });

    it('allows access for sufficient role level', () => {
      const ctx = makeEnhancedCtx({ memberId: 'mem-1', highestRoleLevel: 100 });
      expect(canAccessMemberResource(ctx, 'mem-2', 50)).toBe(true);
    });

    it('denies access to others resource with low role', () => {
      const ctx = makeEnhancedCtx({ memberId: 'mem-1', highestRoleLevel: 10 });
      expect(canAccessMemberResource(ctx, 'mem-2')).toBe(false);
    });
  });

  // ── getPrimaryRole ───────────────────────────────────────────────
  describe('getPrimaryRole', () => {
    it('returns first role (highest level)', () => {
      const role = { roleName: 'admin', roleCode: 'admin', roleLevel: 95 } as never;
      const ctx = makeEnhancedCtx({ roles: [role] });
      expect(getPrimaryRole(ctx)).toEqual(role);
    });

    it('returns null when no roles', () => {
      const ctx = makeEnhancedCtx({ roles: [] });
      expect(getPrimaryRole(ctx)).toBeNull();
    });
  });

  // ── getRolesForScope ─────────────────────────────────────────────
  describe('getRolesForScope', () => {
    it('returns roles matching scope type', () => {
      const roles = [
        { roleName: 'steward', scopeType: 'department', scopeValue: 'HR' },
        { roleName: 'officer', scopeType: 'global', scopeValue: null },
        { roleName: 'member', scopeType: 'unit', scopeValue: 'A' },
      ] as never[];
      const ctx = makeEnhancedCtx({ roles });
      const result = getRolesForScope(ctx, 'department');
      expect(result.length).toBe(2); // department + global
    });

    it('filters by scope value', () => {
      const roles = [
        { roleName: 'steward', scopeType: 'department', scopeValue: 'HR' },
        { roleName: 'officer', scopeType: 'department', scopeValue: 'IT' },
      ] as never[];
      const ctx = makeEnhancedCtx({ roles });
      expect(getRolesForScope(ctx, 'department', 'HR').length).toBe(1);
    });
  });

  // ── getServerSession ─────────────────────────────────────────────
  describe('getServerSession', () => {
    it('returns session-like object', async () => {
      const session = await getServerSession();
      expect(session!.user.id).toBe('user_123');
      expect(session!.user.email).toBe('test@union.org');
      expect(session!.expires).toBeDefined();
    });

    it('returns null when not authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      expect(await getServerSession()).toBeNull();
    });
  });

  // ── requireAuth (legacy) ─────────────────────────────────────────
  describe('requireAuth', () => {
    it('returns AuthUser when authenticated', async () => {
      const user = await requireAuth();
      expect(user.id).toBe('user_123');
    });

    it('throws when not authenticated', async () => {
      mocks.mockAuth.mockResolvedValue({ userId: null, orgId: null });
      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });
  });
});
