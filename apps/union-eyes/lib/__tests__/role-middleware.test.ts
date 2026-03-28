/**
 * Unit tests for role-middleware.ts
 *
 * Validates that the runtime role hierarchy matches the full RBAC system
 * and that fine-grained roles (health_safety_rep, bargaining_committee, etc.)
 * are NOT collapsed into the simplified "member" tier.
 */
import { describe, it, expect } from 'vitest';
import { hasRolePermission, type MemberRole } from '../role-middleware';
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
