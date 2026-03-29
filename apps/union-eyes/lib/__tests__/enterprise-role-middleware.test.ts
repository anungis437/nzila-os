/**
 * Tests for enterprise-role-middleware.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockGetMemberRoles: vi.fn(),
  mockGetMemberHighestRoleLevel: vi.fn(),
  mockGetMemberEffectivePermissions: vi.fn(),
  mockLogPermissionCheck: vi.fn(),
  mockIncrementExceptionUsage: vi.fn(),
  mockWithOrgAuth: vi.fn(),
  mockDbExecute: vi.fn(),
}));

vi.mock('../organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: (...args: unknown[]) => unknown) => {
    return async (req: NextRequest) => {
      const ctx = mocks.mockWithOrgAuth();
      return handler(req, ctx);
    };
  }),
}));

vi.mock('@/db/queries/enhanced-rbac-queries', () => ({
  getMemberRoles: mocks.mockGetMemberRoles,
  getMemberHighestRoleLevel: mocks.mockGetMemberHighestRoleLevel,
  getMemberEffectivePermissions: mocks.mockGetMemberEffectivePermissions,
  logPermissionCheck: mocks.mockLogPermissionCheck,
  incrementExceptionUsage: mocks.mockIncrementExceptionUsage,
}));

vi.mock('@/db/db', () => ({
  db: { execute: mocks.mockDbExecute },
}));

vi.mock('drizzle-orm', () => ({
  sql: (..._a: unknown[]) => 'query',
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  withEnhancedRoleAuth,
  withPermission,
  withScopedRoleAuth,
  requirePermission,
  requireRoleLevel,
  requireScope,
  canAccessMemberResource,
  getPrimaryRole,
  getRolesForScope,
  type EnhancedRoleContext,
} from '../enterprise-role-middleware';

function makeContext(overrides: Partial<EnhancedRoleContext> = {}): EnhancedRoleContext {
  return {
    organizationId: 'org-1',
    userId: 'user-1',
    memberId: 'mem-1',
    roles: [{ roleLevel: 80, roleName: 'Steward', roleCode: 'steward', scopeType: 'global', scopeValue: null } as never],
    highestRoleLevel: 80,
    permissions: ['read', 'write', 'create_claim'],
    hasPermission: (p: string) => overrides.permissions?.includes(p) ?? ['read', 'write', 'create_claim'].includes(p),
    checkScope: () => true,
    ...overrides,
  };
}

describe('enterprise-role-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockLogPermissionCheck.mockResolvedValue(undefined);
    mocks.mockDbExecute.mockResolvedValue([]);
  });

  // ── withEnhancedRoleAuth ──────────────────────────────────────────────────
  describe('withEnhancedRoleAuth', () => {
    it('returns 403 when no memberId in context', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'user-1', memberId: null });
      const handler = vi.fn();
      const wrapped = withEnhancedRoleAuth(50, handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 403 when role level is insufficient', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(10);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue([]);
      const handler = vi.fn();
      const wrapped = withEnhancedRoleAuth(50, handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
    });

    it('calls handler when role level is sufficient', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([{ roleLevel: 80 }]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(80);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue(['read']);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withEnhancedRoleAuth(50, handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(handler).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('returns 403 when scope check fails', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([
        { roleLevel: 80, scopeType: 'department', scopeValue: 'HR' },
      ]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(80);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue([]);
      const handler = vi.fn();
      const wrapped = withEnhancedRoleAuth(50, handler, {
        scopeType: 'department',
        scopeValue: 'Manufacturing',
        allowGlobalScope: false,
      });
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
    });

    it('returns 500 on unexpected error', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockRejectedValue(new Error('DB error'));
      const handler = vi.fn();
      const wrapped = withEnhancedRoleAuth(50, handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(500);
    });
  });

  // ── withPermission ────────────────────────────────────────────────────────
  describe('withPermission', () => {
    it('allows when permission matches', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([{ roleLevel: 80 }]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(80);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue(['create_claim']);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withPermission('create_claim', handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(200);
    });

    it('allows wildcard permission', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(100);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue(['*']);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withPermission('any_permission', handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(200);
    });

    it('denies when permission is missing', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(80);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue(['read']);
      const handler = vi.fn();
      const wrapped = withPermission('delete_claim', handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
    });

    it('returns 403 when no memberId', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: null });
      const handler = vi.fn();
      const wrapped = withPermission('read', handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
    });
  });

  // ── withScopedRoleAuth ────────────────────────────────────────────────────
  describe('withScopedRoleAuth', () => {
    it('allows matching role with scope', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([
        { roleCode: 'dept_steward', roleName: 'Dept Steward', roleLevel: 50, scopeType: 'department', scopeValue: 'HR' },
      ]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(50);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue([]);
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const wrapped = withScopedRoleAuth('dept_steward', 'department', handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(200);
    });

    it('denies when no matching scoped role', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: 'm1' });
      mocks.mockGetMemberRoles.mockResolvedValue([
        { roleCode: 'steward', roleName: 'Steward', scopeType: 'global', scopeValue: null },
      ]);
      mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(80);
      mocks.mockGetMemberEffectivePermissions.mockResolvedValue([]);
      const handler = vi.fn();
      const wrapped = withScopedRoleAuth('dept_steward', 'department', handler, { allowGlobalScope: false });
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
    });

    it('returns 403 when no memberId', async () => {
      mocks.mockWithOrgAuth.mockReturnValue({ organizationId: 'org-1', userId: 'u1', memberId: null });
      const handler = vi.fn();
      const wrapped = withScopedRoleAuth('steward', 'global', handler);
      const response = await wrapped(new NextRequest('http://localhost/api/test'));
      expect(response.status).toBe(403);
    });
  });

  // ── Context helpers ───────────────────────────────────────────────────────
  describe('requirePermission', () => {
    it('does not throw when permission exists', async () => {
      const ctx = makeContext({ permissions: ['create_claim'] });
      await expect(requirePermission(ctx, 'create_claim')).resolves.toBeUndefined();
    });

    it('throws when permission is missing', async () => {
      const ctx = makeContext({ permissions: [], hasPermission: () => false });
      await expect(requirePermission(ctx, 'delete_claim')).rejects.toThrow('Permission required');
    });
  });

  describe('requireRoleLevel', () => {
    it('does not throw when level is sufficient', async () => {
      const ctx = makeContext({ highestRoleLevel: 80 });
      await expect(requireRoleLevel(ctx, 50)).resolves.toBeUndefined();
    });

    it('throws when level is insufficient', async () => {
      const ctx = makeContext({ highestRoleLevel: 10 });
      await expect(requireRoleLevel(ctx, 50)).rejects.toThrow('Role level 50 required');
    });
  });

  describe('requireScope', () => {
    it('does not throw when scope matches', () => {
      const ctx = makeContext({ checkScope: () => true });
      expect(() => requireScope(ctx, 'department', 'HR')).not.toThrow();
    });

    it('throws when scope does not match', () => {
      const ctx = makeContext({ checkScope: () => false });
      expect(() => requireScope(ctx, 'department', 'HR')).toThrow('Scope required');
    });
  });

  describe('canAccessMemberResource', () => {
    it('allows access to own resource', () => {
      const ctx = makeContext({ memberId: 'mem-1', highestRoleLevel: 10 });
      expect(canAccessMemberResource(ctx, 'mem-1')).toBe(true);
    });

    it('allows access with sufficient role level', () => {
      const ctx = makeContext({ memberId: 'mem-1', highestRoleLevel: 80 });
      expect(canAccessMemberResource(ctx, 'mem-other', 50)).toBe(true);
    });

    it('denies access with insufficient role level', () => {
      const ctx = makeContext({ memberId: 'mem-1', highestRoleLevel: 10 });
      expect(canAccessMemberResource(ctx, 'mem-other', 50)).toBe(false);
    });
  });

  describe('getPrimaryRole', () => {
    it('returns first role (highest level)', () => {
      const roles = [{ roleName: 'Admin', roleLevel: 100 }, { roleName: 'Member', roleLevel: 10 }] as never[];
      const ctx = makeContext({ roles });
      expect(getPrimaryRole(ctx)).toEqual({ roleName: 'Admin', roleLevel: 100 });
    });

    it('returns null for empty roles', () => {
      const ctx = makeContext({ roles: [] });
      expect(getPrimaryRole(ctx)).toBeNull();
    });
  });

  describe('getRolesForScope', () => {
    it('returns matching scope roles', () => {
      const roles = [
        { scopeType: 'global', scopeValue: null },
        { scopeType: 'department', scopeValue: 'HR' },
        { scopeType: 'department', scopeValue: 'IT' },
      ] as never[];
      const ctx = makeContext({ roles });
      const result = getRolesForScope(ctx, 'department');
      // global + 2 department
      expect(result).toHaveLength(3);
    });

    it('filters by scope value', () => {
      const roles = [
        { scopeType: 'department', scopeValue: 'HR' },
        { scopeType: 'department', scopeValue: 'IT' },
      ] as never[];
      const ctx = makeContext({ roles });
      const result = getRolesForScope(ctx, 'department', 'HR');
      expect(result).toHaveLength(1);
    });

    it('excludes non-matching scope types', () => {
      const roles = [{ scopeType: 'location', scopeValue: 'NYC' }] as never[];
      const ctx = makeContext({ roles });
      const result = getRolesForScope(ctx, 'department');
      expect(result).toHaveLength(0);
    });
  });
});
