import { describe, it, expect, vi } from 'vitest';
import { UserRole, Permission, ROLE_PERMISSIONS } from '../roles';

// Mock drizzle DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => []),
        })),
      })),
    })),
  },
}));
vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: {
    role: 'role',
    organizationId: 'organizationId',
    userId: 'userId',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

import {
  roleHasPermission,
  anyRoleHasPermission,
  getPermissionsForRole,
  getPermissionsForRoles,
  checkUserPermission,
  checkUserRole,
} from '../permissions';

describe('roleHasPermission', () => {
  it('returns true when role has permission', () => {
    expect(roleHasPermission(UserRole.ADMIN, Permission.VIEW_ALL_CLAIMS)).toBe(true);
  });

  it('returns false when role lacks permission', () => {
    expect(roleHasPermission(UserRole.MEMBER, Permission.DELETE_CLAIM)).toBe(false);
  });
});

describe('anyRoleHasPermission', () => {
  it('returns true if at least one role has the permission', () => {
    expect(anyRoleHasPermission([UserRole.GUEST, UserRole.ADMIN], Permission.VIEW_ALL_CLAIMS)).toBe(true);
  });

  it('returns false if no role has it', () => {
    expect(anyRoleHasPermission([UserRole.GUEST, UserRole.MEMBER], Permission.DELETE_CLAIM)).toBe(false);
  });
});

describe('getPermissionsForRole', () => {
  it('returns permissions array for valid role', () => {
    const perms = getPermissionsForRole(UserRole.STEWARD);
    expect(perms).toEqual(ROLE_PERMISSIONS[UserRole.STEWARD]);
  });

  it('returns empty array for unknown role', () => {
    const perms = getPermissionsForRole('nonexistent' as UserRole);
    expect(perms).toEqual([]);
  });
});

describe('getPermissionsForRoles', () => {
  it('unions permissions across multiple roles', () => {
    const perms = getPermissionsForRoles([UserRole.MEMBER, UserRole.STEWARD]);
    // MEMBER has VIEW_OWN_CLAIMS, STEWARD has VIEW_ALL_CLAIMS
    expect(perms).toContain(Permission.VIEW_OWN_CLAIMS);
    expect(perms).toContain(Permission.VIEW_ALL_CLAIMS);
  });

  it('deduplicates overlapping permissions', () => {
    const perms = getPermissionsForRoles([UserRole.ADMIN, UserRole.PRESIDENT]);
    const unique = new Set(perms);
    expect(perms.length).toBe(unique.size);
  });

  it('returns empty array for empty roles', () => {
    expect(getPermissionsForRoles([])).toEqual([]);
  });
});

describe('checkUserPermission (deprecated)', () => {
  it('returns false when organizationId is missing', async () => {
    const result = await checkUserPermission({
      userId: 'user1',
      permission: Permission.VIEW_ALL_CLAIMS,
    });
    expect(result).toBe(false);
  });

  it('returns false when db query returns no member', async () => {
    const result = await checkUserPermission({
      userId: 'user1',
      organizationId: 'org1',
      permission: Permission.VIEW_ALL_CLAIMS,
    });
    expect(result).toBe(false);
  });
});

describe('checkUserRole (deprecated)', () => {
  it('returns false when organizationId is missing', async () => {
    const result = await checkUserRole({
      userId: 'user1',
      role: UserRole.ADMIN,
    });
    expect(result).toBe(false);
  });
});
