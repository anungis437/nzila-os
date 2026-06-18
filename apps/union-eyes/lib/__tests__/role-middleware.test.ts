/**
 * Unit tests for role-middleware.ts
 *
 * Validates that the runtime role hierarchy matches the full RBAC system
 * and that fine-grained roles (health_safety_rep, bargaining_committee, etc.)
 * are NOT collapsed into the simplified "member" tier.
 * Also tests the withRoleAuth / withAnyRole middleware wrappers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockGetMemberByUserId: vi.fn(),
}));

vi.mock('@/db/queries/organization-members-queries', () => ({
  getMemberByUserId: mocks.mockGetMemberByUserId,
}));

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn((innerHandler: (req: any, ctx: any, params?: any) => unknown) => {
    return (request: any, params?: any) => {
      const orgContext = { organizationId: 'org-1', userId: 'user-1' };
      return innerHandler(request, orgContext, params);
    };
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Static imports (safe — only pure functions, not middleware) ───────────

import { hasRolePermission, checkRole, requireAdmin, type MemberRole, type RoleContext } from '../role-middleware';
import { UserRole } from '../auth/roles';

// ── Hierarchy ordering ──────────────────────────────────────────────────────

describe('hasRolePermission – full hierarchy', () => {
  // Ordered from lowest to highest privilege (local-union subset)
  const LOCAL_ROLES: MemberRole[] = [
    UserRole.MEMBER,
    UserRole.HEALTH_SAFETY_REP,
    UserRole.BARGAINING_COMMITTEE,
    UserRole.STEWARD,
    UserRole.OFFICER,
    UserRole.CHIEF_STEWARD,
    UserRole.SECRETARY_TREASURER,
    UserRole.VICE_PRESIDENT,
    UserRole.PRESIDENT,
    UserRole.ADMIN,
  ];

  it('each role can access its own level', () => {
    for (const role of LOCAL_ROLES) {
      expect(
        hasRolePermission(role, role),
        `${role} should have permission for ${role}`,
      ).toBe(true);
    }
  });

  it('higher roles can access lower role resources', () => {
    for (let i = 1; i < LOCAL_ROLES.length; i++) {
      const higher = LOCAL_ROLES[i]!;
      const lower = LOCAL_ROLES[0]!; // member
      expect(
        hasRolePermission(higher, lower),
        `${higher} should have permission for ${lower}`,
      ).toBe(true);
    }
  });

  it('lower roles cannot access higher role resources', () => {
    const member = UserRole.MEMBER;
    const rolesAboveMember = LOCAL_ROLES.slice(1);

    for (const higher of rolesAboveMember) {
      expect(
        hasRolePermission(member, higher),
        `member should NOT have permission for ${higher}`,
      ).toBe(false);
    }
  });
});

// ── Fine-grained role differentiation ────────────────────────────────────────

describe('fine-grained roles are not collapsed', () => {
  it('health_safety_rep outranks member', () => {
    expect(hasRolePermission(UserRole.HEALTH_SAFETY_REP, UserRole.MEMBER)).toBe(true);
    expect(hasRolePermission(UserRole.MEMBER, UserRole.HEALTH_SAFETY_REP)).toBe(false);
  });

  it('bargaining_committee outranks health_safety_rep', () => {
    expect(hasRolePermission(UserRole.BARGAINING_COMMITTEE, UserRole.HEALTH_SAFETY_REP)).toBe(true);
    expect(hasRolePermission(UserRole.HEALTH_SAFETY_REP, UserRole.BARGAINING_COMMITTEE)).toBe(false);
  });

  it('steward outranks bargaining_committee', () => {
    expect(hasRolePermission(UserRole.STEWARD, UserRole.BARGAINING_COMMITTEE)).toBe(true);
    expect(hasRolePermission(UserRole.BARGAINING_COMMITTEE, UserRole.STEWARD)).toBe(false);
  });

  it('chief_steward outranks steward', () => {
    expect(hasRolePermission(UserRole.CHIEF_STEWARD, UserRole.STEWARD)).toBe(true);
    expect(hasRolePermission(UserRole.STEWARD, UserRole.CHIEF_STEWARD)).toBe(false);
  });

  it('president outranks vice_president', () => {
    expect(hasRolePermission(UserRole.PRESIDENT, UserRole.VICE_PRESIDENT)).toBe(true);
  });

  it('admin outranks president', () => {
    expect(hasRolePermission(UserRole.ADMIN, UserRole.PRESIDENT)).toBe(true);
    expect(hasRolePermission(UserRole.PRESIDENT, UserRole.ADMIN)).toBe(false);
  });
});

// ── super_admin special handling ─────────────────────────────────────────────

describe('super_admin cross-org access', () => {
  it('super_admin outranks every other role', () => {
    const allRoles: MemberRole[] = [
      UserRole.MEMBER,
      UserRole.HEALTH_SAFETY_REP,
      UserRole.BARGAINING_COMMITTEE,
      UserRole.STEWARD,
      UserRole.OFFICER,
      UserRole.CHIEF_STEWARD,
      UserRole.ADMIN,
      UserRole.APP_OWNER,
    ];

    for (const role of allRoles) {
      expect(
        hasRolePermission('super_admin', role),
        `super_admin should outrank ${role}`,
      ).toBe(true);
    }
  });

  it('no regular role outranks super_admin', () => {
    expect(hasRolePermission(UserRole.APP_OWNER, 'super_admin')).toBe(false);
  });
});

// ── Platform-level hierarchy ─────────────────────────────────────────────────

describe('platform-level roles', () => {
  it('app_owner outranks all local union roles', () => {
    expect(hasRolePermission(UserRole.APP_OWNER, UserRole.ADMIN)).toBe(true);
    expect(hasRolePermission(UserRole.ADMIN, UserRole.APP_OWNER)).toBe(false);
  });

  it('platform_lead outranks national_officer', () => {
    expect(hasRolePermission(UserRole.PLATFORM_LEAD, UserRole.NATIONAL_OFFICER)).toBe(true);
  });

  it('clc_executive outranks federation executive', () => {
    expect(hasRolePermission(UserRole.CLC_EXECUTIVE, UserRole.FED_EXECUTIVE)).toBe(true);
  });

  it('national_officer outranks local admin', () => {
    expect(hasRolePermission(UserRole.NATIONAL_OFFICER, UserRole.ADMIN)).toBe(true);
    expect(hasRolePermission(UserRole.ADMIN, UserRole.NATIONAL_OFFICER)).toBe(false);
  });
});

// ── vice_president and secretary_treasurer are at same level ──────────────────

describe('near-equal roles', () => {
  it('vice_president outranks secretary_treasurer', () => {
    expect(hasRolePermission(UserRole.VICE_PRESIDENT, UserRole.SECRETARY_TREASURER)).toBe(true);
    expect(hasRolePermission(UserRole.SECRETARY_TREASURER, UserRole.VICE_PRESIDENT)).toBe(false);
  });
});

// ── checkRole / requireAdmin helpers ─────────────────────────────────────────

describe('checkRole', () => {
  const ctx: RoleContext = {
    organizationId: 'org-1',
    userId: 'u-1',
    role: UserRole.STEWARD,
    memberId: 'm-1',
  };

  it('returns true when role is sufficient', () => {
    expect(checkRole(ctx, UserRole.MEMBER)).toBe(true);
  });

  it('returns false when role is insufficient', () => {
    expect(checkRole(ctx, UserRole.ADMIN)).toBe(false);
  });
});

describe('requireAdmin', () => {
  it('does not throw for admin role', () => {
    const ctx: RoleContext = { organizationId: 'o', userId: 'u', role: UserRole.ADMIN, memberId: 'm' };
    expect(() => requireAdmin(ctx)).not.toThrow();
  });

  it('throws for non-admin role', () => {
    const ctx: RoleContext = { organizationId: 'o', userId: 'u', role: UserRole.MEMBER, memberId: 'm' };
    expect(() => requireAdmin(ctx)).toThrow('Admin role required');
  });
});

// ── withRoleAuth middleware ──────────────────────────────────────────────────

describe('withRoleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handler when member has sufficient role', async () => {
    mocks.mockGetMemberByUserId.mockResolvedValue({ id: 'm-1', role: 'admin' });
    const { withRoleAuth } = await import('../role-middleware');
    const handler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const route = withRoleAuth('member', handler);
    await route({} as any as NextRequest);
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1', role: 'admin', memberId: 'm-1' }),
      undefined,
    );
  });

  it('returns 403 when role is insufficient', async () => {
    mocks.mockGetMemberByUserId.mockResolvedValue({ id: 'm-1', role: 'member' });
    const { withRoleAuth } = await import('../role-middleware');
    const handler = vi.fn();
    const route = withRoleAuth('admin', handler);
    const response = await route({} as any as NextRequest);
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when member not found', async () => {
    mocks.mockGetMemberByUserId.mockResolvedValue(null);
    const { withRoleAuth } = await import('../role-middleware');
    const handler = vi.fn();
    const route = withRoleAuth('member', handler);
    const response = await route({} as any as NextRequest);
    expect(response.status).toBe(403);
  });

  it('returns 500 on internal error', async () => {
    mocks.mockGetMemberByUserId.mockRejectedValue(new Error('DB down'));
    const { withRoleAuth } = await import('../role-middleware');
    const handler = vi.fn();
    const route = withRoleAuth('member', handler);
    const response = await route({} as any as NextRequest);
    expect(response.status).toBe(500);
  });
});

// ── withAnyRole middleware ────────────────────────────────────────────────────

describe('withAnyRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows access when member has one of the allowed roles', async () => {
    mocks.mockGetMemberByUserId.mockResolvedValue({ id: 'm-1', role: 'steward' });
    const { withAnyRole } = await import('../role-middleware');
    const handler = vi.fn().mockResolvedValue(new Response('ok'));
    const route = withAnyRole(['steward', 'admin'], handler);
    await route({} as any as NextRequest);
    expect(handler).toHaveBeenCalled();
  });

  it('returns 403 when member has none of the allowed roles', async () => {
    mocks.mockGetMemberByUserId.mockResolvedValue({ id: 'm-1', role: 'member' });
    const { withAnyRole } = await import('../role-middleware');
    const handler = vi.fn();
    const route = withAnyRole(['admin', 'president'], handler);
    const response = await route({} as any as NextRequest);
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when member not found', async () => {
    mocks.mockGetMemberByUserId.mockResolvedValue(null);
    const { withAnyRole } = await import('../role-middleware');
    const handler = vi.fn();
    const route = withAnyRole(['admin'], handler);
    const response = await route({} as any as NextRequest);
    expect(response.status).toBe(403);
  });

  it('returns 500 on internal error', async () => {
    mocks.mockGetMemberByUserId.mockRejectedValue(new Error('fail'));
    const { withAnyRole } = await import('../role-middleware');
    const handler = vi.fn();
    const route = withAnyRole(['admin'], handler);
    const response = await route({} as any as NextRequest);
    expect(response.status).toBe(500);
  });
});
