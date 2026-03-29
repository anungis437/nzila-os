import { describe, it, expect } from 'vitest';
import {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  ROUTE_PERMISSIONS,
  NAV_ITEMS,
  ADMIN_NAV_ITEMS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  canAccessRoute,
  getAccessibleNavItems,
  getRoleLevel,
  hasHigherOrEqualRole,
} from '../roles';

describe('UserRole enum', () => {
  it('defines all expected core roles', () => {
    expect(UserRole.APP_OWNER).toBe('app_owner');
    expect(UserRole.SYSTEM_ADMIN).toBe('system_admin');
    expect(UserRole.ADMIN).toBe('admin');
    expect(UserRole.PRESIDENT).toBe('president');
    expect(UserRole.STEWARD).toBe('steward');
    expect(UserRole.MEMBER).toBe('member');
    expect(UserRole.GUEST).toBe('guest');
  });

  it('defines CLC/federation tier roles', () => {
    expect(UserRole.CLC_EXECUTIVE).toBe('clc_executive');
    expect(UserRole.CLC_STAFF).toBe('clc_staff');
    expect(UserRole.FED_EXECUTIVE).toBe('fed_executive');
    expect(UserRole.FED_STAFF).toBe('fed_staff');
    expect(UserRole.NATIONAL_OFFICER).toBe('national_officer');
  });

  it('defines Nzila platform operations roles', () => {
    expect(UserRole.COO).toBe('coo');
    expect(UserRole.CTO).toBe('cto');
    expect(UserRole.PLATFORM_LEAD).toBe('platform_lead');
    expect(UserRole.SUPPORT_MANAGER).toBe('support_manager');
    expect(UserRole.DATA_ANALYTICS_MANAGER).toBe('data_analytics_manager');
    expect(UserRole.BILLING_MANAGER).toBe('billing_manager');
    expect(UserRole.SECURITY_MANAGER).toBe('security_manager');
  });

  it('defines legacy/backward compat roles', () => {
    expect(UserRole.CONGRESS_STAFF).toBe('congress_staff');
    expect(UserRole.FEDERATION_STAFF).toBe('federation_staff');
    expect(UserRole.UNION_REP).toBe('union_rep');
    expect(UserRole.STAFF_REP).toBe('staff_rep');
  });
});

describe('Permission enum', () => {
  it('defines claim permissions', () => {
    expect(Permission.VIEW_ALL_CLAIMS).toBeDefined();
    expect(Permission.VIEW_OWN_CLAIMS).toBeDefined();
    expect(Permission.CREATE_CLAIM).toBeDefined();
    expect(Permission.EDIT_ALL_CLAIMS).toBeDefined();
    expect(Permission.DELETE_CLAIM).toBeDefined();
    expect(Permission.APPROVE_CLAIM).toBeDefined();
  });

  it('defines voting permissions', () => {
    expect(Permission.VIEW_VOTING).toBeDefined();
    expect(Permission.CREATE_VOTE).toBeDefined();
    expect(Permission.CAST_VOTE).toBeDefined();
    expect(Permission.MANAGE_VOTING).toBeDefined();
  });

  it('defines CBA permissions', () => {
    expect(Permission.VIEW_CBA).toBeDefined();
    expect(Permission.EDIT_CBA).toBeDefined();
    expect(Permission.SIGN_CBA).toBeDefined();
    expect(Permission.RATIFY_CBA).toBeDefined();
  });

  it('defines financial permissions', () => {
    expect(Permission.VIEW_FINANCIAL).toBeDefined();
    expect(Permission.MANAGE_FINANCES).toBeDefined();
    expect(Permission.AUDIT_FINANCES).toBeDefined();
  });
});

describe('ROLE_PERMISSIONS mapping', () => {
  it('has permissions defined for every UserRole', () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  it('system admin has all union permissions', () => {
    const sysAdminPerms = ROLE_PERMISSIONS[UserRole.SYSTEM_ADMIN];
    expect(sysAdminPerms).toContain(Permission.VIEW_ALL_CLAIMS);
    expect(sysAdminPerms).toContain(Permission.DELETE_CLAIM);
    expect(sysAdminPerms).toContain(Permission.MANAGE_USERS);
    expect(sysAdminPerms).toContain(Permission.SYSTEM_SETTINGS);
    expect(sysAdminPerms).toContain(Permission.VIEW_ADMIN_PANEL);
  });

  it('member has limited permissions', () => {
    const memberPerms = ROLE_PERMISSIONS[UserRole.MEMBER];
    expect(memberPerms).toContain(Permission.VIEW_OWN_CLAIMS);
    expect(memberPerms).toContain(Permission.CREATE_CLAIM);
    expect(memberPerms).toContain(Permission.VIEW_CBA);
    expect(memberPerms).toContain(Permission.CAST_VOTE);
    expect(memberPerms).not.toContain(Permission.VIEW_ALL_CLAIMS);
    expect(memberPerms).not.toContain(Permission.DELETE_CLAIM);
    expect(memberPerms).not.toContain(Permission.MANAGE_USERS);
  });

  it('guest has minimal permissions', () => {
    const guestPerms = ROLE_PERMISSIONS[UserRole.GUEST];
    expect(guestPerms).toContain(Permission.VIEW_OWN_PROFILE);
    expect(guestPerms).toHaveLength(1);
  });

  it('president has sign CBA and governance permissions', () => {
    const presidentPerms = ROLE_PERMISSIONS[UserRole.PRESIDENT];
    expect(presidentPerms).toContain(Permission.SIGN_CBA);
    expect(presidentPerms).toContain(Permission.APPOINT_COMMITTEES);
    expect(presidentPerms).toContain(Permission.MANAGE_ELECTIONS);
    expect(presidentPerms).toContain(Permission.DELEGATE_AUTHORITY);
  });

  it('secretary-treasurer has financial permissions', () => {
    const stPerms = ROLE_PERMISSIONS[UserRole.SECRETARY_TREASURER];
    expect(stPerms).toContain(Permission.MANAGE_FINANCES);
    expect(stPerms).toContain(Permission.AUDIT_FINANCES);
    expect(stPerms).toContain(Permission.APPROVE_FINANCIAL);
  });

  it('steward has claim assignment permission', () => {
    const stewardPerms = ROLE_PERMISSIONS[UserRole.STEWARD];
    expect(stewardPerms).toContain(Permission.ASSIGN_CLAIMS);
    expect(stewardPerms).toContain(Permission.VIEW_ALL_CLAIMS);
    expect(stewardPerms).toContain(Permission.EDIT_ALL_CLAIMS);
  });

  it('CLC executive has cross-org and congress permissions', () => {
    const clcPerms = ROLE_PERMISSIONS[UserRole.CLC_EXECUTIVE];
    expect(clcPerms).toContain(Permission.CLC_EXECUTIVE_DASHBOARD);
    expect(clcPerms).toContain(Permission.MANAGE_CLC_REMITTANCES);
    expect(clcPerms).toContain(Permission.VIEW_CROSS_UNION_ANALYTICS);
    expect(clcPerms).toContain(Permission.MANAGE_ORGANIZATIONS);
  });

  it('health safety rep has specialized perms', () => {
    const hsPerms = ROLE_PERMISSIONS[UserRole.HEALTH_SAFETY_REP];
    expect(hsPerms).toContain(Permission.MANAGE_HEALTH_SAFETY);
    expect(hsPerms).toContain(Permission.VIEW_HEALTH_SAFETY_CLAIMS);
    expect(hsPerms).toContain(Permission.CREATE_HEALTH_SAFETY_CLAIM);
  });

  it('app owner has strategic dashboard perms', () => {
    const ownerPerms = ROLE_PERMISSIONS[UserRole.APP_OWNER];
    expect(ownerPerms).toContain(Permission.VIEW_STRATEGIC_DASHBOARD);
    expect(ownerPerms).toContain(Permission.MANAGE_ROADMAP);
    expect(ownerPerms).toContain(Permission.VIEW_PLATFORM_KPIS);
  });

  it('all permission arrays contain only valid Permission enum values', () => {
    const validPermissions = new Set(Object.values(Permission));
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const perm of perms) {
        expect(validPermissions.has(perm)).toBe(true);
      }
    }
  });
});

describe('hasPermission', () => {
  it('returns true when role has the permission', () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_ALL_CLAIMS)).toBe(true);
  });

  it('returns false when role lacks the permission', () => {
    expect(hasPermission(UserRole.MEMBER, Permission.DELETE_CLAIM)).toBe(false);
  });

  it('returns false for guest on most permissions', () => {
    expect(hasPermission(UserRole.GUEST, Permission.CREATE_CLAIM)).toBe(false);
  });
});

describe('hasAnyPermission', () => {
  it('returns true if role has at least one of the permissions', () => {
    expect(hasAnyPermission(UserRole.MEMBER, [Permission.VIEW_OWN_CLAIMS, Permission.DELETE_CLAIM])).toBe(true);
  });

  it('returns false if role has none', () => {
    expect(hasAnyPermission(UserRole.GUEST, [Permission.DELETE_CLAIM, Permission.MANAGE_USERS])).toBe(false);
  });

  it('returns true for empty permissions array', () => {
    expect(hasAnyPermission(UserRole.GUEST, [])).toBe(true);
  });
});

describe('hasAllPermissions', () => {
  it('returns true when role has all permissions', () => {
    expect(hasAllPermissions(UserRole.ADMIN, [Permission.VIEW_ALL_CLAIMS, Permission.CREATE_CLAIM])).toBe(true);
  });

  it('returns false when role missing at least one', () => {
    expect(hasAllPermissions(UserRole.MEMBER, [Permission.VIEW_OWN_CLAIMS, Permission.DELETE_CLAIM])).toBe(false);
  });

  it('returns true for empty array', () => {
    expect(hasAllPermissions(UserRole.GUEST, [])).toBe(true);
  });
});

describe('canAccessRoute', () => {
  it('allows access to dashboard for any role', () => {
    expect(canAccessRoute(UserRole.MEMBER, '/dashboard')).toBe(true);
    expect(canAccessRoute(UserRole.GUEST, '/dashboard')).toBe(true);
  });

  it('restricts admin panel to roles with VIEW_ADMIN_PANEL', () => {
    expect(canAccessRoute(UserRole.ADMIN, '/admin')).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, '/admin')).toBe(false);
  });

  it('allows access to undefined routes', () => {
    expect(canAccessRoute(UserRole.MEMBER, '/some-undefined-route')).toBe(true);
  });

  it('restricts claims route to roles with VIEW_OWN_CLAIMS', () => {
    expect(canAccessRoute(UserRole.MEMBER, '/dashboard/claims')).toBe(true);
    expect(canAccessRoute(UserRole.GUEST, '/dashboard/claims')).toBe(false);
  });

  it('restricts congress route properly', () => {
    expect(canAccessRoute(UserRole.CLC_EXECUTIVE, '/dashboard/congress')).toBe(true);
    expect(canAccessRoute(UserRole.MEMBER, '/dashboard/congress')).toBe(false);
  });
});

describe('getAccessibleNavItems', () => {
  it('returns nav items accessible to admin', () => {
    const items = getAccessibleNavItems(UserRole.ADMIN);
    expect(items.length).toBeGreaterThan(0);
    expect(items.map(i => i.href)).toContain('/dashboard');
  });

  it('returns fewer items for member', () => {
    const adminItems = getAccessibleNavItems(UserRole.ADMIN);
    const memberItems = getAccessibleNavItems(UserRole.MEMBER);
    expect(memberItems.length).toBeLessThanOrEqual(adminItems.length);
  });

  it('returns admin nav items when adminMode=true', () => {
    const items = getAccessibleNavItems(UserRole.ADMIN, true);
    expect(items.length).toBeGreaterThan(0);
    const hrefs = items.map(i => i.href);
    expect(hrefs.some(h => h.startsWith('/admin'))).toBe(true);
  });

  it('returns no admin nav items for member', () => {
    const items = getAccessibleNavItems(UserRole.MEMBER, true);
    expect(items).toHaveLength(0);
  });
});

describe('getRoleLevel', () => {
  it('APP_OWNER has highest level', () => {
    expect(getRoleLevel(UserRole.APP_OWNER)).toBe(250);
  });

  it('GUEST has level 0', () => {
    expect(getRoleLevel(UserRole.GUEST)).toBe(0);
  });

  it('hierarchy is ordered correctly', () => {
    expect(getRoleLevel(UserRole.APP_OWNER)).toBeGreaterThan(getRoleLevel(UserRole.COO));
    expect(getRoleLevel(UserRole.SYSTEM_ADMIN)).toBeGreaterThan(getRoleLevel(UserRole.ADMIN));
    expect(getRoleLevel(UserRole.ADMIN)).toBeGreaterThan(getRoleLevel(UserRole.PRESIDENT));
    expect(getRoleLevel(UserRole.PRESIDENT)).toBeGreaterThan(getRoleLevel(UserRole.STEWARD));
    expect(getRoleLevel(UserRole.STEWARD)).toBeGreaterThan(getRoleLevel(UserRole.MEMBER));
    expect(getRoleLevel(UserRole.MEMBER)).toBeGreaterThan(getRoleLevel(UserRole.GUEST));
  });

  it('legacy roles map to same level as new roles', () => {
    expect(getRoleLevel(UserRole.CONGRESS_STAFF)).toBe(getRoleLevel(UserRole.CLC_STAFF));
    expect(getRoleLevel(UserRole.FEDERATION_STAFF)).toBe(getRoleLevel(UserRole.FED_STAFF));
  });
});

describe('hasHigherOrEqualRole', () => {
  it('admin is higher than member', () => {
    expect(hasHigherOrEqualRole(UserRole.ADMIN, UserRole.MEMBER)).toBe(true);
  });

  it('member is not higher than admin', () => {
    expect(hasHigherOrEqualRole(UserRole.MEMBER, UserRole.ADMIN)).toBe(false);
  });

  it('same role returns true', () => {
    expect(hasHigherOrEqualRole(UserRole.STEWARD, UserRole.STEWARD)).toBe(true);
  });
});

describe('ROUTE_PERMISSIONS', () => {
  it('defines permissions for core routes', () => {
    expect(ROUTE_PERMISSIONS['/dashboard']).toEqual([]);
    expect(ROUTE_PERMISSIONS['/admin']).toContain(Permission.VIEW_ADMIN_PANEL);
    expect(ROUTE_PERMISSIONS['/dashboard/claims']).toContain(Permission.VIEW_OWN_CLAIMS);
  });
});

describe('NAV_ITEMS / ADMIN_NAV_ITEMS', () => {
  it('NAV_ITEMS has Dashboard as first item', () => {
    expect(NAV_ITEMS[0].href).toBe('/dashboard');
    expect(NAV_ITEMS[0].requiredPermissions).toEqual([]);
  });

  it('ADMIN_NAV_ITEMS all have adminOnly true', () => {
    for (const item of ADMIN_NAV_ITEMS) {
      expect(item.adminOnly).toBe(true);
    }
  });
});

// ─── Batch 34: branch gap-fill ──────────────────────────────────────────────
describe('Batch 34: branch gap-fill', () => {
  it('hasPermission returns false for an unknown role', () => {
    expect(hasPermission('totally_fake_role' as UserRole, Permission.VIEW_ALL_CLAIMS)).toBe(false);
  });

  it('getRoleLevel returns 0 for an unknown role', () => {
    expect(getRoleLevel('totally_fake_role' as UserRole)).toBe(0);
  });
});
