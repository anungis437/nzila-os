import { describe, it, expect, vi } from 'vitest';
import { UserRole } from '../roles';

// Mock os-core/policy
vi.mock('@nzila/os-core/policy', () => ({
  authorize: vi.fn().mockResolvedValue({ userId: 'u1', role: 'viewer' }),
  withAuth: vi.fn((opts: any, handler: (...args: any[]) => unknown) => handler),
  authorizeOrgAccess: vi.fn().mockResolvedValue(true),
  AuthorizationError: class AuthorizationError extends Error {},
  UERole: {
    SUPERVISOR: 'supervisor',
    CASE_MANAGER: 'case_manager',
    ANALYST: 'analyst',
    VIEWER: 'viewer',
  },
}));

import { mapToOsRole, authorizeRoute, withAuthorizedRoute, UERole } from '../policy-adapter';

describe('mapToOsRole', () => {
  it('maps admin roles to SUPERVISOR', () => {
    expect(mapToOsRole(UserRole.APP_OWNER)).toBe(UERole.SUPERVISOR);
    expect(mapToOsRole(UserRole.SYSTEM_ADMIN)).toBe(UERole.SUPERVISOR);
    expect(mapToOsRole(UserRole.ADMIN)).toBe(UERole.SUPERVISOR);
    expect(mapToOsRole(UserRole.PRESIDENT)).toBe(UERole.SUPERVISOR);
  });

  it('maps case-working roles to CASE_MANAGER', () => {
    expect(mapToOsRole(UserRole.STEWARD)).toBe(UERole.CASE_MANAGER);
    expect(mapToOsRole(UserRole.CHIEF_STEWARD)).toBe(UERole.CASE_MANAGER);
    expect(mapToOsRole(UserRole.OFFICER)).toBe(UERole.CASE_MANAGER);
    expect(mapToOsRole(UserRole.SUPPORT_AGENT)).toBe(UERole.CASE_MANAGER);
  });

  it('maps analytics roles to ANALYST', () => {
    expect(mapToOsRole(UserRole.DATA_ANALYST)).toBe(UERole.ANALYST);
    expect(mapToOsRole(UserRole.BILLING_MANAGER)).toBe(UERole.ANALYST);
    expect(mapToOsRole(UserRole.CLC_STAFF)).toBe(UERole.ANALYST);
  });

  it('maps member/guest to VIEWER', () => {
    expect(mapToOsRole(UserRole.MEMBER)).toBe(UERole.VIEWER);
    expect(mapToOsRole(UserRole.GUEST)).toBe(UERole.VIEWER);
  });

  it('falls back to VIEWER for unknown role', () => {
    expect(mapToOsRole('unknown_role')).toBe(UERole.VIEWER);
  });

  it('maps CLC/federation executives correctly', () => {
    expect(mapToOsRole(UserRole.CLC_EXECUTIVE)).toBe(UERole.SUPERVISOR);
    expect(mapToOsRole(UserRole.FED_EXECUTIVE)).toBe(UERole.SUPERVISOR);
    expect(mapToOsRole(UserRole.NATIONAL_OFFICER)).toBe(UERole.SUPERVISOR);
  });

  it('maps legacy roles', () => {
    expect(mapToOsRole(UserRole.CONGRESS_STAFF)).toBe(UERole.ANALYST);
    expect(mapToOsRole(UserRole.FEDERATION_STAFF)).toBe(UERole.ANALYST);
    expect(mapToOsRole(UserRole.UNION_REP)).toBe(UERole.CASE_MANAGER);
    expect(mapToOsRole(UserRole.STAFF_REP)).toBe(UERole.CASE_MANAGER);
  });
});

describe('authorizeRoute', () => {
  it('delegates to os-core authorize', async () => {
    const req = new Request('http://localhost/api/test');
    const ctx = await authorizeRoute(req);
    expect(ctx).toHaveProperty('userId');
  });
});

describe('withAuthorizedRoute', () => {
  it('returns a function', () => {
    const handler = withAuthorizedRoute({}, async () => new Response());
    expect(typeof handler).toBe('function');
  });
});
