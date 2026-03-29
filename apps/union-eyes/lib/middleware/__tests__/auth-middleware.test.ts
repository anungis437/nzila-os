import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import {
  AuthenticationService,
  AuthenticationAuditLog,
  SUPPORTED_ROLES,
  ROLE_PERMISSIONS,
  requireAuth,
  requireRole,
  type AuthenticatedUser,
} from '../auth-middleware';

/* ------------------------------------------------------------------ */
/* SUPPORTED_ROLES & ROLE_PERMISSIONS                                  */
/* ------------------------------------------------------------------ */
describe('SUPPORTED_ROLES', () => {
  it('contains expected role keys', () => {
    expect(SUPPORTED_ROLES.ADMIN).toBe('admin');
    expect(SUPPORTED_ROLES.MEMBER).toBe('member');
    expect(SUPPORTED_ROLES.OFFICER).toBe('officer');
    expect(SUPPORTED_ROLES.TREASURER).toBe('treasurer');
    expect(SUPPORTED_ROLES.AUDITOR).toBe('auditor');
    expect(SUPPORTED_ROLES.DELEGATE).toBe('delegate');
    expect(SUPPORTED_ROLES.VIEWER).toBe('viewer');
  });
});

describe('ROLE_PERMISSIONS', () => {
  it('admin has manage:members', () => {
    expect(ROLE_PERMISSIONS[SUPPORTED_ROLES.ADMIN]).toContain('manage:members');
  });

  it('member can submit claims', () => {
    expect(ROLE_PERMISSIONS[SUPPORTED_ROLES.MEMBER]).toContain('submit:claims');
  });

  it('every role has read:organization', () => {
    Object.values(SUPPORTED_ROLES).forEach(role => {
      expect(ROLE_PERMISSIONS[role]).toContain('read:organization');
    });
  });
});

/* ------------------------------------------------------------------ */
/* AuthenticationService                                               */
/* ------------------------------------------------------------------ */
describe('AuthenticationService', () => {
  const adminUser: AuthenticatedUser = {
    id: 'u1',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['admin'],
    organizationId: 'org-1',
  };

  const memberUser: AuthenticatedUser = {
    id: 'u2',
    email: 'member@test.com',
    firstName: 'Member',
    lastName: 'User',
    roles: ['member'],
    organizationId: 'org-1',
  };

  describe('hasRole', () => {
    it('returns true when user has role', () => {
      expect(AuthenticationService.hasRole(adminUser, SUPPORTED_ROLES.ADMIN)).toBe(true);
    });

    it('returns false when user lacks role', () => {
      expect(AuthenticationService.hasRole(memberUser, SUPPORTED_ROLES.ADMIN)).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('returns true for valid permission', () => {
      expect(AuthenticationService.hasPermission(adminUser, 'manage:members')).toBe(true);
    });

    it('returns false for missing permission', () => {
      expect(AuthenticationService.hasPermission(memberUser, 'manage:members')).toBe(false);
    });

    it('handles unknown role gracefully', () => {
      const u: AuthenticatedUser = { ...memberUser, roles: ['unknown'] };
      expect(AuthenticationService.hasPermission(u, 'manage:members')).toBe(false);
    });
  });

  describe('hasRoles', () => {
    it('returns true if any role matches', () => {
      expect(AuthenticationService.hasRoles(adminUser, [SUPPORTED_ROLES.ADMIN, SUPPORTED_ROLES.OFFICER])).toBe(true);
    });

    it('returns false if no role matches', () => {
      expect(AuthenticationService.hasRoles(memberUser, [SUPPORTED_ROLES.ADMIN, SUPPORTED_ROLES.OFFICER])).toBe(false);
    });
  });

  describe('canAccessOrganization', () => {
    it('admin can access any org', () => {
      expect(AuthenticationService.canAccessOrganization(adminUser, 'org-other')).toBe(true);
    });

    it('member can only access own org', () => {
      expect(AuthenticationService.canAccessOrganization(memberUser, 'org-1')).toBe(true);
      expect(AuthenticationService.canAccessOrganization(memberUser, 'org-other')).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when session is null', async () => {
      const user = await AuthenticationService.getCurrentUser();
      expect(user).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/* AuthenticationAuditLog                                              */
/* ------------------------------------------------------------------ */
describe('AuthenticationAuditLog', () => {
  beforeEach(() => {
    // Ensure clean state by reading events
    const existing = AuthenticationAuditLog.getEvents();
    // We can't clear directly, so we accept cumulative state
  });

  it('logs and retrieves events', () => {
    AuthenticationAuditLog.log({
      userId: 'u1',
      eventType: 'LOGIN',
    });
    const events = AuthenticationAuditLog.getEvents({ userId: 'u1', eventType: 'LOGIN' });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by eventType', () => {
    AuthenticationAuditLog.log({ eventType: 'LOGIN_FAILED', reason: 'bad creds' });
    const failed = AuthenticationAuditLog.getEvents({ eventType: 'LOGIN_FAILED' });
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  it('getStats returns summary', () => {
    const stats = AuthenticationAuditLog.getStats();
    expect(stats).toHaveProperty('totalAuthEvents');
    expect(stats).toHaveProperty('successfulLogins');
    expect(stats).toHaveProperty('failedLogins');
    expect(stats).toHaveProperty('failureRate');
    expect(stats).toHaveProperty('deniedPermissions');
  });
});

/* ------------------------------------------------------------------ */
/* requireAuth / requireRole                                           */
/* ------------------------------------------------------------------ */
describe('requireAuth', () => {
  it('returns error when no user', async () => {
    const result = await requireAuth();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.status).toBe(401);
  });
});

describe('requireRole', () => {
  it('returns error when no user', async () => {
    const result = await requireRole(SUPPORTED_ROLES.ADMIN);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.status).toBe(401);
  });
});
