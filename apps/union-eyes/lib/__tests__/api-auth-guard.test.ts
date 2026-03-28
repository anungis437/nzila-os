/**
 * API Auth Guard — Unit Tests
 *
 * Tests:
 *   - ROLE_HIERARCHY constant structure and completeness
 *   - LEGACY_ROLE_MAP backward compatibility
 *   - normalizeRole() pure function
 *   - getCurrentUser() with mocked Clerk + DB
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock external deps BEFORE imports ────────────────────────────────────────
// vi.mock factories are hoisted — NO references to module-scope const/let

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

vi.mock('next/server', () => ({
  NextRequest: vi.fn(),
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 })),
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      organizationMembers: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: { id: 'id', userId: 'userId', organizationId: 'organizationId', role: 'role', status: 'status', membershipNumber: 'membershipNumber', clerkOrganizationId: 'clerkOrganizationId' },
  organizations: { id: 'id', clerkOrganizationId: 'clerkOrganizationId' },
}));

vi.mock('@/db/schema/domains/member', () => ({
  users: { userId: 'userId', isSystemAdmin: 'isSystemAdmin' },
}));

vi.mock('@/db/queries/enhanced-rbac-queries', () => ({
  getMemberRoles: vi.fn().mockResolvedValue([]),
  getMemberHighestRoleLevel: vi.fn().mockResolvedValue(0),
  getMemberEffectivePermissions: vi.fn().mockResolvedValue([]),
  logPermissionCheck: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./public-routes', () => ({
  PUBLIC_API_ROUTES: [],
  CRON_API_ROUTES: [],
  isPublicRoute: vi.fn().mockReturnValue(false),
  isCronRoute: vi.fn().mockReturnValue(false),
}));

import {
  ROLE_HIERARCHY,
  LEGACY_ROLE_MAP,
  normalizeRole,
  type UserRole,
} from '../api-auth-guard';

// ─── ROLE_HIERARCHY ──────────────────────────────────────────────────────────

describe('ROLE_HIERARCHY', () => {
  it('has app_owner at the top (300)', () => {
    expect(ROLE_HIERARCHY.app_owner).toBe(300);
  });

  it('has member at the bottom (10)', () => {
    expect(ROLE_HIERARCHY.member).toBe(10);
  });

  it('contains all expected tiers', () => {
    // Spot-check key roles from each hierarchical tier
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

// ─── LEGACY_ROLE_MAP ─────────────────────────────────────────────────────────

describe('LEGACY_ROLE_MAP', () => {
  it('maps super_admin to admin', () => {
    expect(LEGACY_ROLE_MAP.super_admin).toBe('admin');
  });

  it('maps guest to member', () => {
    expect(LEGACY_ROLE_MAP.guest).toBe('member');
  });

  it('maps union_officer to officer', () => {
    expect(LEGACY_ROLE_MAP.union_officer).toBe('officer');
  });

  it('maps union_steward to steward', () => {
    expect(LEGACY_ROLE_MAP.union_steward).toBe('steward');
  });

  it('maps CLC legacy roles', () => {
    expect(LEGACY_ROLE_MAP.congress_staff).toBe('clc_staff');
    expect(LEGACY_ROLE_MAP.federation_staff).toBe('fed_staff');
  });

  it('all mapped values are valid ROLE_HIERARCHY keys', () => {
    for (const [legacy, mapped] of Object.entries(LEGACY_ROLE_MAP)) {
      expect(
        ROLE_HIERARCHY[mapped as UserRole],
        `Legacy role '${legacy}' maps to '${mapped}' which should be in ROLE_HIERARCHY`,
      ).toBeDefined();
    }
  });
});

// ─── normalizeRole ──────────────────────────────────────────────────────────

describe('normalizeRole', () => {
  it('returns role as-is if it exists in ROLE_HIERARCHY', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('steward')).toBe('steward');
    expect(normalizeRole('member')).toBe('member');
  });

  it('maps legacy roles via LEGACY_ROLE_MAP', () => {
    expect(normalizeRole('super_admin')).toBe('admin');
    expect(normalizeRole('guest')).toBe('member');
    expect(normalizeRole('union_steward')).toBe('steward');
  });

  it('defaults to member for unknown roles', () => {
    expect(normalizeRole('unknown')).toBe('member');
    expect(normalizeRole('')).toBe('member');
  });

  it('gives LEGACY_ROLE_MAP priority over ROLE_HIERARCHY', () => {
    // 'super_admin' is NOT in ROLE_HIERARCHY, only in LEGACY_ROLE_MAP
    // Should always resolve via legacy map first
    expect(normalizeRole('super_admin')).toBe('admin');
  });
});

// ─── getCurrentUser (mocked) ─────────────────────────────────────────────────

describe('getCurrentUser', () => {
  let getCurrentUserFn: typeof import('../api-auth-guard').getCurrentUser;

  // Grab mocked auth/currentUser from the already-mocked module
  let mockAuth: ReturnType<typeof vi.fn>;
  let mockClerkCurrentUser: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // The top-level vi.mock is already in place. We just need fresh mock impls.
    const clerkMod = await import('@clerk/nextjs/server');
    mockAuth = vi.mocked(clerkMod.auth);
    mockClerkCurrentUser = vi.mocked(clerkMod.currentUser);
    mockAuth.mockReset();
    mockClerkCurrentUser.mockReset();

    const { getCurrentUser } = await import('../api-auth-guard');
    getCurrentUserFn = getCurrentUser;
  });

  it('returns null when no userId from auth()', async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });
    const result = await getCurrentUserFn();
    expect(result).toBeNull();
  });

  it('returns null when Clerk currentUser returns null', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: null });
    mockClerkCurrentUser.mockResolvedValue(null);
    const result = await getCurrentUserFn();
    expect(result).toBeNull();
  });

  it('returns AuthUser with email and role from metadata', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123', orgId: null });
    mockClerkCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'test@union.org' }],
      fullName: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      imageUrl: 'https://img.example.com/avatar.png',
      publicMetadata: { role: 'steward' },
      privateMetadata: {},
    });

    const user = await getCurrentUserFn();
    expect(user).not.toBeNull();
    expect(user!.id).toBe('user_123');
    expect(user!.email).toBe('test@union.org');
    expect(user!.role).toBe('steward');
  });

  it('grants app_owner when user is in PLATFORM_ADMIN_USER_IDS', async () => {
    const originalEnv = process.env.PLATFORM_ADMIN_USER_IDS;
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_admin_1,user_admin_2';

    mockAuth.mockResolvedValue({ userId: 'user_admin_1', orgId: null });
    mockClerkCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'admin@nzila.com' }],
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      imageUrl: null,
      publicMetadata: { role: 'member' }, // Metadata says member…
      privateMetadata: {},
    });

    const user = await getCurrentUserFn();
    expect(user).not.toBeNull();
    expect(user!.role).toBe('app_owner'); // …but PLATFORM_ADMIN_USER_IDS overrides

    process.env.PLATFORM_ADMIN_USER_IDS = originalEnv;
  });
});
