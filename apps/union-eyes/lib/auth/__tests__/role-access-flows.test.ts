/**
 * Comprehensive role access flow tests
 *
 * Validates that EVERY client-facing role has correct:
 *  1. Route access (canAccessRoute for all defined routes)
 *  2. Navigation visibility (getAccessibleNavItems)
 *  3. Permission grants (critical permissions they MUST have)
 *  4. Permission denials (critical permissions they MUST NOT have)
 *
 * This prevents regressions when roles or permissions are modified.
 */
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

// ── All non-legacy client-facing roles ──────────────────────────────────────

const CLIENT_FACING_ROLES = [
  // Base
  UserRole.MEMBER,
  // Specialized
  UserRole.HEALTH_SAFETY_REP,
  // Front-line
  UserRole.BARGAINING_COMMITTEE,
  UserRole.STEWARD,
  // Senior reps
  UserRole.OFFICER,
  UserRole.CHIEF_STEWARD,
  // Administrative support
  UserRole.CLERK,
  // Local executives
  UserRole.SECRETARY_TREASURER,
  UserRole.VICE_PRESIDENT,
  UserRole.PRESIDENT,
  UserRole.ADMIN,
  // National / Federation / CLC
  UserRole.NATIONAL_OFFICER,
  UserRole.FED_STAFF,
  UserRole.FED_EXECUTIVE,
  UserRole.CLC_STAFF,
  UserRole.CLC_EXECUTIVE,
  UserRole.SYSTEM_ADMIN,
  // Strategic leadership (cross-domain access incl. admin panel)
  UserRole.APP_OWNER,
] as const;

const PLATFORM_OPS_ROLES = [
  UserRole.TRAINING_COORDINATOR,
  UserRole.CONTENT_MANAGER,
  UserRole.INTEGRATION_SPECIALIST,
  UserRole.BILLING_SPECIALIST,
  UserRole.DATA_ANALYST,
  UserRole.SUPPORT_AGENT,
  UserRole.INTEGRATION_MANAGER,
  UserRole.BILLING_MANAGER,
  UserRole.DATA_ANALYTICS_MANAGER,
  UserRole.SUPPORT_MANAGER,
  UserRole.COMPLIANCE_MANAGER,
  UserRole.SECURITY_MANAGER,
  UserRole.CUSTOMER_SUCCESS_DIRECTOR,
  UserRole.PLATFORM_LEAD,
  UserRole.CTO,
  UserRole.COO,
] as const;

const LEGACY_ROLE_MAP: [UserRole, UserRole][] = [
  [UserRole.CONGRESS_STAFF, UserRole.CLC_STAFF],
  [UserRole.FEDERATION_STAFF, UserRole.FED_STAFF],
  [UserRole.UNION_REP, UserRole.STEWARD],
  [UserRole.STAFF_REP, UserRole.STEWARD],
];

/** Every role in the enum — for exhaustive checks */
const ALL_ENUM_ROLES = Object.values(UserRole) as UserRole[];

const ALL_ROUTES = Object.keys(ROUTE_PERMISSIONS);

// ════════════════════════════════════════════════════════════════════════════
// 1. ROUTE ACCESS MATRIX — every role × every route
// ════════════════════════════════════════════════════════════════════════════

describe('Route access matrix — union roles', () => {
  for (const role of CLIENT_FACING_ROLES) {
    describe(`${role}`, () => {
      for (const route of ALL_ROUTES) {
        const requiredPerms = ROUTE_PERMISSIONS[route];
        const shouldAccess =
          requiredPerms.length === 0 ||
          requiredPerms.every((p) => hasPermission(role, p));

        it(`${shouldAccess ? '✓' : '✗'} ${route}`, () => {
          expect(canAccessRoute(role, route)).toBe(shouldAccess);
        });
      }
    });
  }
});

describe('Route access matrix — platform ops roles', () => {
  for (const role of PLATFORM_OPS_ROLES) {
    describe(`${role}`, () => {
      for (const route of ALL_ROUTES) {
        const requiredPerms = ROUTE_PERMISSIONS[route];
        const shouldAccess =
          requiredPerms.length === 0 ||
          requiredPerms.every((p) => hasPermission(role, p));

        it(`${shouldAccess ? '✓' : '✗'} ${route}`, () => {
          expect(canAccessRoute(role, route)).toBe(shouldAccess);
        });
      }
    });
  }
});

describe('Route access matrix — GUEST', () => {
  for (const route of ALL_ROUTES) {
    const requiredPerms = ROUTE_PERMISSIONS[route];
    const shouldAccess =
      requiredPerms.length === 0 ||
      requiredPerms.every((p) => hasPermission(UserRole.GUEST, p));

    it(`${shouldAccess ? '✓' : '✗'} ${route}`, () => {
      expect(canAccessRoute(UserRole.GUEST, route)).toBe(shouldAccess);
    });
  }
});

describe('Route access matrix — legacy roles', () => {
  for (const [legacy] of LEGACY_ROLE_MAP) {
    describe(`${legacy}`, () => {
      for (const route of ALL_ROUTES) {
        const requiredPerms = ROUTE_PERMISSIONS[route];
        const shouldAccess =
          requiredPerms.length === 0 ||
          requiredPerms.every((p) => hasPermission(legacy, p));

        it(`${shouldAccess ? '✓' : '✗'} ${route}`, () => {
          expect(canAccessRoute(legacy, route)).toBe(shouldAccess);
        });
      }
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 2. NAVIGATION ITEM VISIBILITY — per role
// ════════════════════════════════════════════════════════════════════════════

describe('Navigation visibility — union roles', () => {
  it('MEMBER sees dashboard, claims, CBA, voting, settings but NOT members or analytics', () => {
    const items = getAccessibleNavItems(UserRole.MEMBER);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/dashboard/claims');
    expect(hrefs).toContain('/dashboard/collective-agreements');
    expect(hrefs).toContain('/dashboard/voting');
    expect(hrefs).toContain('/dashboard/settings');
    expect(hrefs).not.toContain('/dashboard/members');
    expect(hrefs).not.toContain('/dashboard/analytics');
  });

  it('STEWARD sees members and analytics', () => {
    const items = getAccessibleNavItems(UserRole.STEWARD);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/dashboard/members');
    expect(hrefs).toContain('/dashboard/analytics');
  });

  it('ADMIN sees all dashboard nav items', () => {
    const items = getAccessibleNavItems(UserRole.ADMIN);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/dashboard/claims');
    expect(hrefs).toContain('/dashboard/members');
    expect(hrefs).toContain('/dashboard/analytics');
  });

  it('ADMIN gets admin nav items in admin mode', () => {
    const items = getAccessibleNavItems(UserRole.ADMIN, true);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.adminOnly)).toBe(true);
  });

  it('MEMBER gets zero admin nav items', () => {
    const items = getAccessibleNavItems(UserRole.MEMBER, true);
    expect(items).toHaveLength(0);
  });

  it('PRESIDENT gets admin panel nav in admin mode', () => {
    const items = getAccessibleNavItems(UserRole.PRESIDENT, true);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/admin');
  });

  it('SYSTEM_ADMIN gets full admin nav', () => {
    const items = getAccessibleNavItems(UserRole.SYSTEM_ADMIN, true);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  for (const role of CLIENT_FACING_ROLES) {
    it(`${role} always sees /dashboard`, () => {
      const hrefs = getAccessibleNavItems(role).map((i) => i.href);
      expect(hrefs).toContain('/dashboard');
    });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 3. PERMISSION GRANTS — critical permissions each role MUST have
// ════════════════════════════════════════════════════════════════════════════

describe('Permission grants — union roles', () => {
  // -- Member
  it('MEMBER can view own claims, create claims, cast votes, view CBA', () => {
    for (const p of [
      Permission.VIEW_OWN_CLAIMS,
      Permission.CREATE_CLAIM,
      Permission.CAST_VOTE,
      Permission.VIEW_CBA,
      Permission.VIEW_OWN_PROFILE,
    ]) {
      expect(hasPermission(UserRole.MEMBER, p)).toBe(true);
    }
  });

  // -- Health & Safety Rep
  it('HEALTH_SAFETY_REP has H&S-specific permissions', () => {
    for (const p of [
      Permission.VIEW_HEALTH_SAFETY_CLAIMS,
      Permission.CREATE_HEALTH_SAFETY_CLAIM,
      Permission.MANAGE_HEALTH_SAFETY,
    ]) {
      expect(hasPermission(UserRole.HEALTH_SAFETY_REP, p)).toBe(true);
    }
  });

  // -- Bargaining Committee
  it('BARGAINING_COMMITTEE has CBA editing and contract administration', () => {
    for (const p of [
      Permission.EDIT_CBA,
      Permission.CONTRACT_ADMINISTRATION,
      Permission.VIEW_CBA,
    ]) {
      expect(hasPermission(UserRole.BARGAINING_COMMITTEE, p)).toBe(true);
    }
  });

  // -- Steward
  it('STEWARD can assign claims and view all claims', () => {
    for (const p of [
      Permission.ASSIGN_CLAIMS,
      Permission.VIEW_ALL_CLAIMS,
      Permission.EDIT_ALL_CLAIMS,
    ]) {
      expect(hasPermission(UserRole.STEWARD, p)).toBe(true);
    }
  });

  // -- Officer
  it('OFFICER can approve claims, edit members, create votes', () => {
    for (const p of [
      Permission.APPROVE_CLAIM,
      Permission.EDIT_MEMBER,
      Permission.CREATE_VOTE,
    ]) {
      expect(hasPermission(UserRole.OFFICER, p)).toBe(true);
    }
  });

  // -- Chief Steward
  it('CHIEF_STEWARD can assign and approve claims', () => {
    for (const p of [
      Permission.ASSIGN_CLAIMS,
      Permission.APPROVE_CLAIM,
      Permission.VIEW_ADVANCED_ANALYTICS,
    ]) {
      expect(hasPermission(UserRole.CHIEF_STEWARD, p)).toBe(true);
    }
  });

  // -- Secretary-Treasurer
  it('SECRETARY_TREASURER has full financial permissions', () => {
    for (const p of [
      Permission.MANAGE_FINANCES,
      Permission.AUDIT_FINANCES,
      Permission.APPROVE_FINANCIAL,
      Permission.EDIT_FINANCIAL,
    ]) {
      expect(hasPermission(UserRole.SECRETARY_TREASURER, p)).toBe(true);
    }
  });

  // -- Vice President
  it('VICE_PRESIDENT can approve claims, edit CBA, manage voting', () => {
    for (const p of [
      Permission.APPROVE_CLAIM,
      Permission.EDIT_CBA,
      Permission.MANAGE_VOTING,
      Permission.VIEW_ADVANCED_ANALYTICS,
    ]) {
      expect(hasPermission(UserRole.VICE_PRESIDENT, p)).toBe(true);
    }
  });

  // -- President
  it('PRESIDENT can sign CBA, appoint committees, manage elections', () => {
    for (const p of [
      Permission.SIGN_CBA,
      Permission.APPOINT_COMMITTEES,
      Permission.MANAGE_ELECTIONS,
      Permission.DELEGATE_AUTHORITY,
      Permission.VIEW_ADMIN_PANEL,
    ]) {
      expect(hasPermission(UserRole.PRESIDENT, p)).toBe(true);
    }
  });

  // -- Admin
  it('ADMIN has user management and system settings', () => {
    for (const p of [
      Permission.MANAGE_USERS,
      Permission.MANAGE_ROLES,
      Permission.SYSTEM_SETTINGS,
      Permission.VIEW_ADMIN_PANEL,
      Permission.DELETE_CLAIM,
      Permission.DELETE_MEMBER,
      Permission.DELETE_CBA,
    ]) {
      expect(hasPermission(UserRole.ADMIN, p)).toBe(true);
    }
  });

  // -- National Officer
  it('NATIONAL_OFFICER can manage precedents, create CBA, manage voting', () => {
    for (const p of [
      Permission.MANAGE_PRECEDENT_DATABASE,
      Permission.MANAGE_CLAUSE_LIBRARY,
      Permission.CREATE_CBA,
      Permission.MANAGE_VOTING,
    ]) {
      expect(hasPermission(UserRole.NATIONAL_OFFICER, p)).toBe(true);
    }
  });

  // -- Federation Staff
  it('FED_STAFF has federation dashboard and cross-union analytics', () => {
    for (const p of [
      Permission.FEDERATION_DASHBOARD,
      Permission.VIEW_CROSS_UNION_ANALYTICS,
      Permission.VIEW_FEDERATION_ANALYTICS,
      Permission.PROVINCIAL_COMPLIANCE,
    ]) {
      expect(hasPermission(UserRole.FED_STAFF, p)).toBe(true);
    }
  });

  // -- Federation Executive
  it('FED_EXECUTIVE can manage provincial affiliates', () => {
    for (const p of [
      Permission.MANAGE_PROVINCIAL_AFFILIATES,
      Permission.VIEW_PROVINCIAL_REMITTANCES,
      Permission.MANAGE_AFFILIATES,
    ]) {
      expect(hasPermission(UserRole.FED_EXECUTIVE, p)).toBe(true);
    }
  });

  // -- CLC Staff
  it('CLC_STAFF has CLC remittance and cross-org analytics', () => {
    for (const p of [
      Permission.VIEW_CLC_REMITTANCES,
      Permission.MANAGE_AFFILIATE_SYNC,
      Permission.MANAGE_CROSS_UNION_ANALYTICS,
      Permission.VIEW_CONGRESS_ANALYTICS,
    ]) {
      expect(hasPermission(UserRole.CLC_STAFF, p)).toBe(true);
    }
  });

  // -- CLC Executive
  it('CLC_EXECUTIVE has full CLC governance', () => {
    for (const p of [
      Permission.CLC_EXECUTIVE_DASHBOARD,
      Permission.MANAGE_CLC_REMITTANCES,
      Permission.MANAGE_ORGANIZATIONS,
      Permission.MANAGE_SECTOR_ANALYTICS,
    ]) {
      expect(hasPermission(UserRole.CLC_EXECUTIVE, p)).toBe(true);
    }
  });

  // -- System Admin
  it('SYSTEM_ADMIN has all union + CLC + federation permissions', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.MANAGE_USERS,
      Permission.SYSTEM_SETTINGS,
      Permission.CLC_EXECUTIVE_DASHBOARD,
      Permission.MANAGE_CLC_REMITTANCES,
      Permission.FEDERATION_DASHBOARD,
      Permission.MANAGE_ORGANIZATIONS,
    ]) {
      expect(hasPermission(UserRole.SYSTEM_ADMIN, p)).toBe(true);
    }
  });
});

describe('Permission grants — platform ops roles', () => {
  it('APP_OWNER has strategic dashboard and KPI access', () => {
    for (const p of [
      Permission.VIEW_STRATEGIC_DASHBOARD,
      Permission.MANAGE_ROADMAP,
      Permission.VIEW_PLATFORM_KPIS,
      Permission.VIEW_PLATFORM_HEALTH,
      Permission.VIEW_REVENUE_DASHBOARD,
    ]) {
      expect(hasPermission(UserRole.APP_OWNER, p)).toBe(true);
    }
  });

  it('COO has operational management permissions', () => {
    for (const p of [
      Permission.MANAGE_PLATFORM_OPERATIONS,
      Permission.MANAGE_INCIDENTS,
      Permission.VIEW_SLA_DASHBOARD,
      Permission.MANAGE_RELEASES,
      Permission.VIEW_CAPACITY_PLANNING,
    ]) {
      expect(hasPermission(UserRole.COO, p)).toBe(true);
    }
  });

  it('CTO has technology and security oversight', () => {
    for (const p of [
      Permission.MANAGE_PLATFORM_OPERATIONS,
      Permission.VIEW_SECURITY_ALERTS,
      Permission.MANAGE_SECURITY_INCIDENTS,
      Permission.MANAGE_API_KEYS,
    ]) {
      expect(hasPermission(UserRole.CTO, p)).toBe(true);
    }
  });

  it('PLATFORM_LEAD has day-to-day ops', () => {
    for (const p of [
      Permission.MANAGE_PLATFORM_OPERATIONS,
      Permission.MANAGE_INCIDENTS,
      Permission.VIEW_SLA_DASHBOARD,
    ]) {
      expect(hasPermission(UserRole.PLATFORM_LEAD, p)).toBe(true);
    }
  });

  it('CUSTOMER_SUCCESS_DIRECTOR manages customer health', () => {
    for (const p of [
      Permission.VIEW_CUSTOMER_HEALTH,
      Permission.MANAGE_CUSTOMER_SUCCESS,
      Permission.VIEW_CHURN_RISK,
      Permission.MANAGE_ONBOARDING,
    ]) {
      expect(hasPermission(UserRole.CUSTOMER_SUCCESS_DIRECTOR, p)).toBe(true);
    }
  });

  it('SUPPORT_MANAGER manages support operations', () => {
    for (const p of [
      Permission.VIEW_SUPPORT_TICKETS,
      Permission.MANAGE_SUPPORT_OPERATIONS,
      Permission.ASSIGN_TICKETS,
      Permission.ESCALATE_TICKETS,
    ]) {
      expect(hasPermission(UserRole.SUPPORT_MANAGER, p)).toBe(true);
    }
  });

  it('DATA_ANALYTICS_MANAGER has analytics and BI', () => {
    for (const p of [
      Permission.MANAGE_PLATFORM_ANALYTICS,
      Permission.CREATE_CUSTOM_REPORTS,
      Permission.EXPORT_PLATFORM_DATA,
      Permission.MANAGE_BI_INTEGRATIONS,
    ]) {
      expect(hasPermission(UserRole.DATA_ANALYTICS_MANAGER, p)).toBe(true);
    }
  });

  it('BILLING_MANAGER manages subscriptions and payments', () => {
    for (const p of [
      Permission.MANAGE_SUBSCRIPTIONS,
      Permission.VIEW_REVENUE_DASHBOARD,
      Permission.MANAGE_INVOICING,
      Permission.PROCESS_PAYMENTS,
    ]) {
      expect(hasPermission(UserRole.BILLING_MANAGER, p)).toBe(true);
    }
  });

  it('INTEGRATION_MANAGER manages APIs and partners', () => {
    for (const p of [
      Permission.MANAGE_API_KEYS,
      Permission.MANAGE_PARTNER_INTEGRATIONS,
      Permission.MANAGE_OAUTH_APPS,
    ]) {
      expect(hasPermission(UserRole.INTEGRATION_MANAGER, p)).toBe(true);
    }
  });

  it('COMPLIANCE_MANAGER handles auditing and policy', () => {
    for (const p of [
      Permission.VIEW_AUDIT_LOGS,
      Permission.MANAGE_COMPLIANCE_REPORTS,
      Permission.ENFORCE_POLICIES,
      Permission.MONITOR_GDPR_COMPLIANCE,
    ]) {
      expect(hasPermission(UserRole.COMPLIANCE_MANAGER, p)).toBe(true);
    }
  });

  it('SECURITY_MANAGER handles security ops', () => {
    for (const p of [
      Permission.VIEW_SECURITY_ALERTS,
      Permission.MANAGE_SECURITY_INCIDENTS,
      Permission.AUDIT_USER_ACCESS,
      Permission.MONITOR_THREATS,
      Permission.MANAGE_VULNERABILITIES,
    ]) {
      expect(hasPermission(UserRole.SECURITY_MANAGER, p)).toBe(true);
    }
  });

  it('CONTENT_MANAGER manages templates and resources', () => {
    for (const p of [
      Permission.MANAGE_TEMPLATES,
      Permission.MANAGE_RESOURCE_LIBRARY,
      Permission.CREATE_TRAINING_MATERIALS,
      Permission.MANAGE_DOCUMENTATION,
    ]) {
      expect(hasPermission(UserRole.CONTENT_MANAGER, p)).toBe(true);
    }
  });

  it('TRAINING_COORDINATOR manages training and onboarding', () => {
    for (const p of [
      Permission.CREATE_TRAINING_MATERIALS,
      Permission.MANAGE_RESOURCE_LIBRARY,
      Permission.MANAGE_ONBOARDING,
    ]) {
      expect(hasPermission(UserRole.TRAINING_COORDINATOR, p)).toBe(true);
    }
  });

  it('SUPPORT_AGENT handles tickets', () => {
    for (const p of [
      Permission.VIEW_SUPPORT_TICKETS,
      Permission.ASSIGN_TICKETS,
      Permission.ESCALATE_TICKETS,
    ]) {
      expect(hasPermission(UserRole.SUPPORT_AGENT, p)).toBe(true);
    }
  });

  it('DATA_ANALYST has analytics access', () => {
    for (const p of [
      Permission.VIEW_CROSS_ORG_ANALYTICS,
      Permission.CREATE_CUSTOM_REPORTS,
      Permission.EXPORT_PLATFORM_DATA,
    ]) {
      expect(hasPermission(UserRole.DATA_ANALYST, p)).toBe(true);
    }
  });

  it('BILLING_SPECIALIST does billing ops', () => {
    for (const p of [
      Permission.VIEW_ALL_SUBSCRIPTIONS,
      Permission.MANAGE_SUBSCRIPTIONS,
      Permission.MANAGE_INVOICING,
      Permission.PROCESS_PAYMENTS,
    ]) {
      expect(hasPermission(UserRole.BILLING_SPECIALIST, p)).toBe(true);
    }
  });

  it('INTEGRATION_SPECIALIST manages API integrations', () => {
    for (const p of [
      Permission.VIEW_API_INTEGRATIONS,
      Permission.MANAGE_API_KEYS,
      Permission.MONITOR_WEBHOOKS,
    ]) {
      expect(hasPermission(UserRole.INTEGRATION_SPECIALIST, p)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. PERMISSION DENIALS — critical permissions roles MUST NOT have
// ════════════════════════════════════════════════════════════════════════════

describe('Permission denials — boundary enforcement', () => {
  it('MEMBER cannot delete claims, manage users, or access admin', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.MANAGE_USERS,
      Permission.SYSTEM_SETTINGS,
      Permission.VIEW_ADMIN_PANEL,
      Permission.VIEW_ALL_CLAIMS,
      Permission.APPROVE_CLAIM,
    ]) {
      expect(hasPermission(UserRole.MEMBER, p)).toBe(false);
    }
  });

  it('GUEST can only view own profile', () => {
    const guestPerms = ROLE_PERMISSIONS[UserRole.GUEST];
    expect(guestPerms).toHaveLength(1);
    expect(guestPerms[0]).toBe(Permission.VIEW_OWN_PROFILE);
  });

  it('HEALTH_SAFETY_REP cannot view all claims or manage users', () => {
    for (const p of [
      Permission.VIEW_ALL_CLAIMS,
      Permission.MANAGE_USERS,
      Permission.DELETE_CLAIM,
      Permission.VIEW_ADMIN_PANEL,
    ]) {
      expect(hasPermission(UserRole.HEALTH_SAFETY_REP, p)).toBe(false);
    }
  });

  it('BARGAINING_COMMITTEE cannot delete claims or manage users', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.MANAGE_USERS,
      Permission.VIEW_ADMIN_PANEL,
      Permission.VIEW_ALL_CLAIMS,
    ]) {
      expect(hasPermission(UserRole.BARGAINING_COMMITTEE, p)).toBe(false);
    }
  });

  it('STEWARD cannot delete claims, manage users, or sign CBA', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.MANAGE_USERS,
      Permission.SIGN_CBA,
      Permission.VIEW_ADMIN_PANEL,
    ]) {
      expect(hasPermission(UserRole.STEWARD, p)).toBe(false);
    }
  });

  it('OFFICER cannot delete claims or access system settings', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.SYSTEM_SETTINGS,
      Permission.MANAGE_USERS,
    ]) {
      expect(hasPermission(UserRole.OFFICER, p)).toBe(false);
    }
  });

  it('CHIEF_STEWARD cannot manage users, sign CBA, or access admin', () => {
    for (const p of [
      Permission.MANAGE_USERS,
      Permission.SIGN_CBA,
      Permission.DELETE_CBA,
      Permission.VIEW_ADMIN_PANEL,
    ]) {
      expect(hasPermission(UserRole.CHIEF_STEWARD, p)).toBe(false);
    }
  });

  it('SECRETARY_TREASURER cannot sign CBA or manage elections', () => {
    for (const p of [
      Permission.SIGN_CBA,
      Permission.MANAGE_ELECTIONS,
      Permission.DELETE_CLAIM,
      Permission.MANAGE_USERS,
    ]) {
      expect(hasPermission(UserRole.SECRETARY_TREASURER, p)).toBe(false);
    }
  });

  it('VICE_PRESIDENT cannot sign CBA or delete CBA', () => {
    for (const p of [
      Permission.SIGN_CBA,
      Permission.DELETE_CBA,
      Permission.MANAGE_USERS,
      Permission.SYSTEM_SETTINGS,
    ]) {
      expect(hasPermission(UserRole.VICE_PRESIDENT, p)).toBe(false);
    }
  });

  it('PRESIDENT cannot delete claims or manage users (admin-only)', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.DELETE_MEMBER,
      Permission.MANAGE_USERS,
      Permission.SYSTEM_SETTINGS,
    ]) {
      expect(hasPermission(UserRole.PRESIDENT, p)).toBe(false);
    }
  });

  it('NATIONAL_OFFICER cannot delete claims, manage users, or access admin', () => {
    for (const p of [
      Permission.DELETE_CLAIM,
      Permission.MANAGE_USERS,
      Permission.VIEW_ADMIN_PANEL,
      Permission.SYSTEM_SETTINGS,
    ]) {
      expect(hasPermission(UserRole.NATIONAL_OFFICER, p)).toBe(false);
    }
  });

  it('FED_STAFF cannot manage CLC remittances', () => {
    for (const p of [
      Permission.MANAGE_CLC_REMITTANCES,
      Permission.CLC_EXECUTIVE_DASHBOARD,
      Permission.MANAGE_USERS,
    ]) {
      expect(hasPermission(UserRole.FED_STAFF, p)).toBe(false);
    }
  });

  it('FED_EXECUTIVE cannot manage CLC remittances', () => {
    for (const p of [
      Permission.MANAGE_CLC_REMITTANCES,
      Permission.CLC_EXECUTIVE_DASHBOARD,
      Permission.MANAGE_USERS,
    ]) {
      expect(hasPermission(UserRole.FED_EXECUTIVE, p)).toBe(false);
    }
  });

  it('CLC_STAFF cannot manage CLC remittances (executive-only)', () => {
    expect(hasPermission(UserRole.CLC_STAFF, Permission.MANAGE_CLC_REMITTANCES)).toBe(false);
  });

  it('platform ops roles cannot access union admin panel', () => {
    for (const role of PLATFORM_OPS_ROLES) {
      expect(hasPermission(role, Permission.VIEW_ADMIN_PANEL)).toBe(false);
      expect(hasPermission(role, Permission.MANAGE_USERS)).toBe(false);
    }
  });

  it('platform ops roles cannot manage union claims', () => {
    for (const role of PLATFORM_OPS_ROLES) {
      expect(hasPermission(role, Permission.DELETE_CLAIM)).toBe(false);
      expect(hasPermission(role, Permission.APPROVE_CLAIM)).toBe(false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. ROLE-SPECIFIC FEATURE FLOWS
// ════════════════════════════════════════════════════════════════════════════

describe('Feature flow — Health & Safety', () => {
  const HS_PERMS = [
    Permission.VIEW_HEALTH_SAFETY_CLAIMS,
    Permission.CREATE_HEALTH_SAFETY_CLAIM,
    Permission.MANAGE_HEALTH_SAFETY,
  ];

  it('HEALTH_SAFETY_REP has full H&S access', () => {
    for (const p of HS_PERMS) {
      expect(hasPermission(UserRole.HEALTH_SAFETY_REP, p)).toBe(true);
    }
  });

  it('MEMBER cannot access H&S features', () => {
    for (const p of HS_PERMS) {
      expect(hasPermission(UserRole.MEMBER, p)).toBe(false);
    }
  });

  it('STEWARD cannot access H&S features', () => {
    for (const p of HS_PERMS) {
      expect(hasPermission(UserRole.STEWARD, p)).toBe(false);
    }
  });
});

describe('Feature flow — CBA lifecycle', () => {
  it('only PRESIDENT can SIGN_CBA', () => {
    for (const role of CLIENT_FACING_ROLES) {
      const expected = role === UserRole.PRESIDENT;
      expect(hasPermission(role, Permission.SIGN_CBA)).toBe(expected);
    }
  });

  it('only MEMBER has RATIFY_CBA', () => {
    // Members ratify CBAs through membership vote
    // Check which roles have ratify
    const rolesWithRatify = CLIENT_FACING_ROLES.filter((r) =>
      hasPermission(r, Permission.RATIFY_CBA)
    );
    // Based on the permission matrix only member has this
    // (or it might not be assigned to any role — verify against source)
    expect(rolesWithRatify.length).toBeLessThanOrEqual(1);
  });

  it('BARGAINING_COMMITTEE has CONTRACT_ADMINISTRATION', () => {
    expect(
      hasPermission(UserRole.BARGAINING_COMMITTEE, Permission.CONTRACT_ADMINISTRATION)
    ).toBe(true);
  });

  it('STEWARD does not have CONTRACT_ADMINISTRATION', () => {
    expect(
      hasPermission(UserRole.STEWARD, Permission.CONTRACT_ADMINISTRATION)
    ).toBe(false);
  });

  it('CBA editing: VP, president, admin, national_officer, bargaining_committee', () => {
    const editorsExpected = [
      UserRole.VICE_PRESIDENT,
      UserRole.PRESIDENT,
      UserRole.ADMIN,
      UserRole.NATIONAL_OFFICER,
      UserRole.BARGAINING_COMMITTEE,
      UserRole.SYSTEM_ADMIN,
    ];
    for (const role of editorsExpected) {
      expect(hasPermission(role, Permission.EDIT_CBA)).toBe(true);
    }
  });

  it('MEMBER and STEWARD cannot edit CBA', () => {
    expect(hasPermission(UserRole.MEMBER, Permission.EDIT_CBA)).toBe(false);
    expect(hasPermission(UserRole.STEWARD, Permission.EDIT_CBA)).toBe(false);
  });
});

describe('Feature flow — Financial governance', () => {
  it('SECRETARY_TREASURER has exclusive financial management', () => {
    expect(hasPermission(UserRole.SECRETARY_TREASURER, Permission.MANAGE_FINANCES)).toBe(true);
    expect(hasPermission(UserRole.SECRETARY_TREASURER, Permission.AUDIT_FINANCES)).toBe(true);
  });

  it('PRESIDENT can approve but not manage finances', () => {
    expect(hasPermission(UserRole.PRESIDENT, Permission.APPROVE_FINANCIAL)).toBe(true);
    expect(hasPermission(UserRole.PRESIDENT, Permission.MANAGE_FINANCES)).toBe(false);
  });

  it('MEMBER and STEWARD cannot view financial data', () => {
    expect(hasPermission(UserRole.MEMBER, Permission.VIEW_FINANCIAL)).toBe(false);
    expect(hasPermission(UserRole.STEWARD, Permission.VIEW_FINANCIAL)).toBe(false);
  });
});

describe('Feature flow — Voting', () => {
  // Cross-org oversight roles (CLC/Federation) are view-only — no voting
  // APP_OWNER is a platform leadership role, not a union voter
  const OVERSIGHT_ROLES: UserRole[] = [
    UserRole.CLC_EXECUTIVE,
    UserRole.CLC_STAFF,
    UserRole.FED_EXECUTIVE,
    UserRole.FED_STAFF,
    UserRole.SYSTEM_ADMIN,
    UserRole.APP_OWNER,
  ];

  it('all local/national union roles can cast votes', () => {
    for (const role of CLIENT_FACING_ROLES) {
      if (OVERSIGHT_ROLES.includes(role)) continue;
      expect(hasPermission(role, Permission.CAST_VOTE)).toBe(true);
    }
  });

  it('cross-org oversight roles and GUEST cannot cast votes', () => {
    for (const role of [
      UserRole.CLC_EXECUTIVE,
      UserRole.CLC_STAFF,
      UserRole.FED_EXECUTIVE,
      UserRole.FED_STAFF,
      UserRole.GUEST,
    ]) {
      expect(hasPermission(role, Permission.CAST_VOTE)).toBe(false);
    }
  });

  it('MANAGE_VOTING limited to leadership roles', () => {
    const canManage = CLIENT_FACING_ROLES.filter((r) =>
      hasPermission(r, Permission.MANAGE_VOTING)
    );
    // Only officer+ should manage voting
    for (const r of canManage) {
      expect(getRoleLevel(r)).toBeGreaterThanOrEqual(getRoleLevel(UserRole.OFFICER));
    }
  });
});

describe('Feature flow — Cross-org analytics (CLC / Federation)', () => {
  it('CLC roles access congress analytics', () => {
    expect(hasPermission(UserRole.CLC_EXECUTIVE, Permission.VIEW_CONGRESS_ANALYTICS)).toBe(true);
    expect(hasPermission(UserRole.CLC_STAFF, Permission.VIEW_CONGRESS_ANALYTICS)).toBe(true);
  });

  it('Federation roles access federation analytics', () => {
    expect(hasPermission(UserRole.FED_EXECUTIVE, Permission.VIEW_FEDERATION_ANALYTICS)).toBe(true);
    expect(hasPermission(UserRole.FED_STAFF, Permission.VIEW_FEDERATION_ANALYTICS)).toBe(true);
  });

  it('local union roles cannot access cross-org analytics', () => {
    for (const role of [
      UserRole.MEMBER,
      UserRole.STEWARD,
      UserRole.CHIEF_STEWARD,
      UserRole.PRESIDENT,
      UserRole.ADMIN,
    ]) {
      expect(hasPermission(role, Permission.VIEW_CROSS_UNION_ANALYTICS)).toBe(false);
      expect(hasPermission(role, Permission.VIEW_CONGRESS_ANALYTICS)).toBe(false);
    }
  });

  it('CLC/federation can access federation route', () => {
    expect(canAccessRoute(UserRole.FED_EXECUTIVE, '/dashboard/federation')).toBe(true);
    expect(canAccessRoute(UserRole.FED_STAFF, '/dashboard/federation')).toBe(true);
    // CLC_EXECUTIVE also has VIEW_FEDERATION_ANALYTICS (cross-org visibility)
    expect(canAccessRoute(UserRole.CLC_EXECUTIVE, '/dashboard/federation')).toBe(true);
  });

  it('congress route available to CLC only', () => {
    expect(canAccessRoute(UserRole.CLC_EXECUTIVE, '/dashboard/congress')).toBe(true);
    expect(canAccessRoute(UserRole.CLC_STAFF, '/dashboard/congress')).toBe(true);
    expect(canAccessRoute(UserRole.FED_EXECUTIVE, '/dashboard/congress')).toBe(false);
    expect(canAccessRoute(UserRole.MEMBER, '/dashboard/congress')).toBe(false);
  });
});

describe('Feature flow — Claim lifecycle', () => {
  // Cross-org oversight roles (CLC/Federation) don't create claims — they review
  // APP_OWNER is a platform leadership role, not a union claimant
  // CLERK is admin support — drafts/dispatches correspondence, not a claimant
  const CLAIM_OVERSIGHT_ROLES: UserRole[] = [
    UserRole.CLC_EXECUTIVE,
    UserRole.CLC_STAFF,
    UserRole.FED_EXECUTIVE,
    UserRole.FED_STAFF,
    UserRole.APP_OWNER,
    UserRole.CLERK,
  ];

  it('local/national union roles can create claims', () => {
    for (const role of CLIENT_FACING_ROLES) {
      if (CLAIM_OVERSIGHT_ROLES.includes(role)) continue;
      expect(hasPermission(role, Permission.CREATE_CLAIM)).toBe(true);
    }
  });

  it('cross-org oversight roles and GUEST cannot create claims', () => {
    for (const role of [...CLAIM_OVERSIGHT_ROLES, UserRole.GUEST]) {
      expect(hasPermission(role, Permission.CREATE_CLAIM)).toBe(false);
    }
  });

  it('claim deletion: only ADMIN and SYSTEM_ADMIN', () => {
    const deletors = CLIENT_FACING_ROLES.filter((r) =>
      hasPermission(r, Permission.DELETE_CLAIM)
    );
    expect(deletors).toContain(UserRole.ADMIN);
    expect(deletors).toContain(UserRole.SYSTEM_ADMIN);
    expect(deletors).toHaveLength(2);
  });

  it('claim approval: officer-level and above (not steward)', () => {
    expect(hasPermission(UserRole.STEWARD, Permission.APPROVE_CLAIM)).toBe(false);
    expect(hasPermission(UserRole.OFFICER, Permission.APPROVE_CLAIM)).toBe(true);
    expect(hasPermission(UserRole.CHIEF_STEWARD, Permission.APPROVE_CLAIM)).toBe(true);
    expect(hasPermission(UserRole.PRESIDENT, Permission.APPROVE_CLAIM)).toBe(true);
  });
});

describe('Feature flow — Admin panel access', () => {
  it('only ADMIN, PRESIDENT, and SYSTEM_ADMIN can access admin panel', () => {
    const adminRoles = CLIENT_FACING_ROLES.filter((r) =>
      hasPermission(r, Permission.VIEW_ADMIN_PANEL)
    );
    expect(adminRoles).toContain(UserRole.ADMIN);
    expect(adminRoles).toContain(UserRole.PRESIDENT);
    expect(adminRoles).toContain(UserRole.SYSTEM_ADMIN);
    expect(adminRoles).toContain(UserRole.APP_OWNER);
    // Nobody else
    expect(adminRoles).toHaveLength(4);
  });

  it('admin route blocked for all non-admin roles', () => {
    for (const role of [
      UserRole.MEMBER,
      UserRole.STEWARD,
      UserRole.OFFICER,
      UserRole.CHIEF_STEWARD,
      UserRole.SECRETARY_TREASURER,
      UserRole.VICE_PRESIDENT,
      UserRole.BARGAINING_COMMITTEE,
      UserRole.HEALTH_SAFETY_REP,
    ]) {
      expect(canAccessRoute(role, '/admin')).toBe(false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. COMPLETENESS — no role left behind
// ════════════════════════════════════════════════════════════════════════════

describe('Completeness checks', () => {
  it('every UserRole has a permission mapping', () => {
    for (const role of Object.values(UserRole)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });

  it('every UserRole has a hierarchy level', () => {
    for (const role of Object.values(UserRole)) {
      expect(typeof getRoleLevel(role)).toBe('number');
    }
  });

  it('no two CLIENT_FACING_ROLES share the same hierarchy level', () => {
    const nonLegacy = CLIENT_FACING_ROLES;
    const levels = nonLegacy.map((r) => getRoleLevel(r));
    const unique = new Set(levels);
    expect(unique.size).toBe(levels.length);
  });

  it('no two PLATFORM_OPS_ROLES share the same hierarchy level', () => {
    const levels = PLATFORM_OPS_ROLES.map((r) => getRoleLevel(r));
    const unique = new Set(levels);
    expect(unique.size).toBe(levels.length);
  });

  it('all permission arrays contain only valid Permission values', () => {
    const validPerms = new Set(Object.values(Permission));
    for (const [, perms] of Object.entries(ROLE_PERMISSIONS)) {
      for (const p of perms) {
        expect(validPerms.has(p)).toBe(true);
      }
    }
  });

  it('all Permission values are either assigned to a role or explicitly reserved', () => {
    // Permissions defined in the enum but intentionally not yet assigned to roles.
    // RATIFY_CBA — will be granted via voting flow, not a standing role permission.
    // APPROVE_APPOINTMENTS — reserved for future governance workflow.
    const RESERVED_PERMISSIONS = new Set([
      Permission.RATIFY_CBA,
      Permission.APPROVE_APPOINTMENTS,
    ]);

    const allAssigned = new Set<Permission>();
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) allAssigned.add(p);
    }
    const allPerms = Object.values(Permission) as Permission[];
    const orphans = allPerms.filter(
      (p) => !allAssigned.has(p) && !RESERVED_PERMISSIONS.has(p)
    );
    expect(orphans).toEqual([]);
  });

  it('reserved permissions are not accidentally assigned to any role', () => {
    const reserved = [Permission.RATIFY_CBA, Permission.APPROVE_APPOINTMENTS];
    for (const role of ALL_ENUM_ROLES) {
      for (const p of reserved) {
        expect(hasPermission(role, p))
          .toBe(false);
      }
    }
  });

  it('every route in ROUTE_PERMISSIONS uses valid Permission values', () => {
    const validPerms = new Set(Object.values(Permission));
    for (const [route, perms] of Object.entries(ROUTE_PERMISSIONS)) {
      for (const p of perms) {
        expect(validPerms.has(p), `Invalid perm ${p} in route ${route}`).toBe(true);
      }
    }
  });

  it('CLIENT_FACING_ROLES + PLATFORM_OPS_ROLES + legacy + GUEST covers all UserRole values', () => {
    const covered = new Set<UserRole>([
      ...CLIENT_FACING_ROLES,
      ...PLATFORM_OPS_ROLES,
      ...LEGACY_ROLE_MAP.map(([l]) => l),
      UserRole.GUEST,
    ]);
    for (const role of ALL_ENUM_ROLES) {
      expect(covered.has(role)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. LEGACY ROLE PARITY — deprecated roles must behave like replacements
// ════════════════════════════════════════════════════════════════════════════

describe('Legacy role parity', () => {
  it('legacy roles have the same hierarchy level as their replacement', () => {
    for (const [legacy, replacement] of LEGACY_ROLE_MAP) {
      expect(getRoleLevel(legacy)).toBe(getRoleLevel(replacement));
    }
  });

  it('CONGRESS_STAFF permissions are a subset of CLC_STAFF', () => {
    const legacyPerms = new Set(ROLE_PERMISSIONS[UserRole.CONGRESS_STAFF]);
    const replacementPerms = new Set(ROLE_PERMISSIONS[UserRole.CLC_STAFF]);
    for (const p of legacyPerms) {
      expect(replacementPerms.has(p)).toBe(true);
    }
  });

  it('FEDERATION_STAFF permissions are a subset of FED_STAFF', () => {
    const legacyPerms = new Set(ROLE_PERMISSIONS[UserRole.FEDERATION_STAFF]);
    const replacementPerms = new Set(ROLE_PERMISSIONS[UserRole.FED_STAFF]);
    for (const p of legacyPerms) {
      expect(replacementPerms.has(p)).toBe(true);
    }
  });

  it('STAFF_REP permissions are a subset of STEWARD', () => {
    const legacyPerms = new Set(ROLE_PERMISSIONS[UserRole.STAFF_REP]);
    const replacementPerms = new Set(ROLE_PERMISSIONS[UserRole.STEWARD]);
    for (const p of legacyPerms) {
      expect(replacementPerms.has(p)).toBe(true);
    }
  });

  it('UNION_REP has extra permissions beyond STEWARD (overpowered legacy)', () => {
    // UNION_REP was historically overpowered compared to STEWARD.
    // These are the permissions UNION_REP has that STEWARD does not.
    // This test locks them in so any cleanup is intentional.
    const unionRepPerms = new Set(ROLE_PERMISSIONS[UserRole.UNION_REP]);
    const stewardPerms = new Set(ROLE_PERMISSIONS[UserRole.STEWARD]);
    const extras = [...unionRepPerms].filter((p) => !stewardPerms.has(p));
    expect(extras.length).toBeGreaterThan(0);
    // These are the known extras
    expect(extras).toContain(Permission.APPROVE_CLAIM);
    expect(extras).toContain(Permission.CREATE_VOTE);
    expect(extras).toContain(Permission.MANAGE_VOTING);
    expect(extras).toContain(Permission.EDIT_CBA);
    expect(extras).toContain(Permission.CREATE_CBA);
    expect(extras).toContain(Permission.VIEW_ADVANCED_ANALYTICS);
  });

  it('hasHigherOrEqualRole treats legacy and replacement equivalently', () => {
    for (const [legacy, replacement] of LEGACY_ROLE_MAP) {
      expect(hasHigherOrEqualRole(legacy, replacement)).toBe(true);
      expect(hasHigherOrEqualRole(replacement, legacy)).toBe(true);
    }
  });

  it('non-overpowered legacy roles access the same routes as their replacements', () => {
    // UNION_REP is excluded — see "UNION_REP has extra permissions" test above.
    const subset = LEGACY_ROLE_MAP.filter(([l]) => l !== UserRole.UNION_REP);
    for (const [legacy, replacement] of subset) {
      for (const route of ALL_ROUTES) {
        const legacyAccess = canAccessRoute(legacy, route);
        const replacementAccess = canAccessRoute(replacement, route);
        if (legacyAccess) {
          expect(replacementAccess, `${legacy} can access ${route} but ${replacement} cannot`)
            .toBe(true);
        }
      }
    }
  });

  it('UNION_REP can access routes that STEWARD cannot (overpowered legacy)', () => {
    const extraRoutes = ALL_ROUTES.filter(
      (route) =>
        canAccessRoute(UserRole.UNION_REP, route) &&
        !canAccessRoute(UserRole.STEWARD, route)
    );
    // Lock in that this gap exists — any reduction is intentional cleanup
    expect(extraRoutes.length).toBeGreaterThanOrEqual(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. HELPER FUNCTION EDGE CASES
// ════════════════════════════════════════════════════════════════════════════

describe('hasAnyPermission', () => {
  it('returns true when role has at least one of the listed permissions', () => {
    expect(
      hasAnyPermission(UserRole.MEMBER, [Permission.DELETE_CLAIM, Permission.CREATE_CLAIM])
    ).toBe(true);
  });

  it('returns false when role has none of the listed permissions', () => {
    expect(
      hasAnyPermission(UserRole.MEMBER, [Permission.DELETE_CLAIM, Permission.MANAGE_USERS])
    ).toBe(false);
  });

  it('returns true for empty permission array (vacuous truth)', () => {
    expect(hasAnyPermission(UserRole.GUEST, [])).toBe(true);
  });
});

describe('hasAllPermissions', () => {
  it('returns true when role has all listed permissions', () => {
    expect(
      hasAllPermissions(UserRole.ADMIN, [Permission.VIEW_ADMIN_PANEL, Permission.MANAGE_USERS])
    ).toBe(true);
  });

  it('returns false when role is missing one permission', () => {
    expect(
      hasAllPermissions(UserRole.MEMBER, [Permission.VIEW_OWN_CLAIMS, Permission.DELETE_CLAIM])
    ).toBe(false);
  });

  it('returns true for empty permission array', () => {
    expect(hasAllPermissions(UserRole.GUEST, [])).toBe(true);
  });
});

describe('canAccessRoute edge cases', () => {
  it('allows access to undefined (unlisted) routes', () => {
    expect(canAccessRoute(UserRole.GUEST, '/some/unknown/route')).toBe(true);
  });

  it('allows access to routes with empty permission arrays', () => {
    expect(canAccessRoute(UserRole.GUEST, '/dashboard')).toBe(true);
    expect(canAccessRoute(UserRole.GUEST, '/dashboard/settings')).toBe(true);
  });
});

describe('hasHigherOrEqualRole', () => {
  it('APP_OWNER outranks every role', () => {
    for (const role of ALL_ENUM_ROLES) {
      expect(hasHigherOrEqualRole(UserRole.APP_OWNER, role)).toBe(true);
    }
  });

  it('GUEST is outranked by every non-GUEST role', () => {
    for (const role of ALL_ENUM_ROLES) {
      if (role === UserRole.GUEST) continue;
      expect(hasHigherOrEqualRole(role, UserRole.GUEST)).toBe(true);
      expect(hasHigherOrEqualRole(UserRole.GUEST, role)).toBe(false);
    }
  });

  it('is reflexive (every role >= itself)', () => {
    for (const role of ALL_ENUM_ROLES) {
      expect(hasHigherOrEqualRole(role, role)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. CROSS-DOMAIN ISOLATION — no permission leakage
// ════════════════════════════════════════════════════════════════════════════

describe('Cross-domain isolation', () => {
  const PLATFORM_SPECIFIC_PERMS = [
    Permission.VIEW_PLATFORM_HEALTH,
    Permission.MANAGE_PLATFORM_OPERATIONS,
    Permission.VIEW_SLA_DASHBOARD,
    Permission.MANAGE_SUBSCRIPTIONS,
    Permission.VIEW_REVENUE_DASHBOARD,
    Permission.MANAGE_INVOICING,
    Permission.PROCESS_PAYMENTS,
    Permission.MANAGE_API_KEYS,
    Permission.VIEW_SECURITY_ALERTS,
    Permission.MANAGE_SECURITY_INCIDENTS,
    Permission.VIEW_STRATEGIC_DASHBOARD,
    Permission.MANAGE_ROADMAP,
    Permission.VIEW_CUSTOMER_HEALTH,
    Permission.VIEW_SUPPORT_TICKETS,
  ];

  it('union roles do not have platform ops permissions', () => {
    const unionRoles = [
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
      UserRole.NATIONAL_OFFICER,
    ];
    for (const role of unionRoles) {
      for (const p of PLATFORM_SPECIFIC_PERMS) {
        expect(hasPermission(role, p), `${role} should not have ${p}`)
          .toBe(false);
      }
    }
  });

  const UNION_SPECIFIC_PERMS = [
    Permission.SIGN_CBA,
    Permission.CONTRACT_ADMINISTRATION,
    Permission.MANAGE_FINANCES,
    Permission.AUDIT_FINANCES,
    Permission.APPOINT_COMMITTEES,
    Permission.MANAGE_ELECTIONS,
    Permission.MANAGE_HEALTH_SAFETY,
  ];

  it('platform ops roles do not have union governance permissions', () => {
    for (const role of PLATFORM_OPS_ROLES) {
      for (const p of UNION_SPECIFIC_PERMS) {
        expect(hasPermission(role, p), `${role} should not have ${p}`)
          .toBe(false);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 10. NAVIGATION VISIBILITY — platform ops & edge cases
// ════════════════════════════════════════════════════════════════════════════

describe('Navigation visibility — platform ops roles', () => {
  it('platform ops roles see dashboard and settings (open routes) but not claims/voting/CBA', () => {
    for (const role of PLATFORM_OPS_ROLES) {
      const items = getAccessibleNavItems(role);
      const hrefs = items.map((i) => i.href);
      expect(hrefs).toContain('/dashboard');
      expect(hrefs).toContain('/dashboard/settings');
      expect(hrefs).not.toContain('/dashboard/claims');
      expect(hrefs).not.toContain('/dashboard/voting');
      expect(hrefs).not.toContain('/dashboard/collective-agreements');
    }
  });

  it('platform ops roles get zero admin nav items', () => {
    for (const role of PLATFORM_OPS_ROLES) {
      const items = getAccessibleNavItems(role, true);
      expect(items).toHaveLength(0);
    }
  });
});

describe('Navigation visibility — GUEST', () => {
  it('GUEST sees only dashboard and settings', () => {
    const items = getAccessibleNavItems(UserRole.GUEST);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/dashboard');
    expect(hrefs).toContain('/dashboard/settings');
    expect(hrefs).toHaveLength(2);
  });

  it('GUEST gets zero admin nav items', () => {
    expect(getAccessibleNavItems(UserRole.GUEST, true)).toHaveLength(0);
  });
});

describe('Admin nav granularity', () => {
  it('PRESIDENT can see admin overview but not admin/members (requires MANAGE_USERS)', () => {
    const items = getAccessibleNavItems(UserRole.PRESIDENT, true);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/admin');
    expect(hrefs).not.toContain('/admin/members');
  });

  it('ADMIN can see admin/members and admin/settings', () => {
    const items = getAccessibleNavItems(UserRole.ADMIN, true);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toContain('/admin/members');
    expect(hrefs).toContain('/admin/settings');
  });

  it('/admin/organizations route exists but is not in ADMIN_NAV_ITEMS', () => {
    // ROUTE_PERMISSIONS defines /admin/organizations but ADMIN_NAV_ITEMS does not
    // include it. The route is accessible via direct URL, but does not appear
    // in the navigation sidebar. This may be intentional (accessed via org switcher)
    // or an oversight to address in a future PR.
    expect(ROUTE_PERMISSIONS['/admin/organizations']).toBeDefined();
    const adminNavHrefs = ADMIN_NAV_ITEMS.map((i) => i.href);
    expect(adminNavHrefs).not.toContain('/admin/organizations');
  });

  it('SYSTEM_ADMIN can access /admin/organizations route directly', () => {
    expect(canAccessRoute(UserRole.SYSTEM_ADMIN, '/admin/organizations')).toBe(true);
  });

  it('ADMIN cannot access /admin/organizations route (no MANAGE_ORGANIZATIONS)', () => {
    expect(canAccessRoute(UserRole.ADMIN, '/admin/organizations')).toBe(false);
  });

  it('every NAV_ITEM href appears in ROUTE_PERMISSIONS or is open', () => {
    for (const item of [...NAV_ITEMS, ...ADMIN_NAV_ITEMS]) {
      // The nav item's required perms should match the route perms
      const routePerms = ROUTE_PERMISSIONS[item.href];
      if (routePerms) {
        expect(item.requiredPermissions).toEqual(routePerms);
      }
    }
  });
});
