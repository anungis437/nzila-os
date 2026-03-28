/**
 * RBAC Server — Unit Tests
 *
 * Tests:
 *   - getUserRole() 6-point fallback chain
 *   - PLATFORM_ADMIN_USER_IDS override
 *   - SUPER_ADMIN_EMAILS override
 *   - Clerk metadata fallback
 *   - getCurrentUserRole() delegation
 *   - requireAuth() / requirePermission() enforcement
 *
 * Tier 1 — Security Perimeter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (factories are hoisted — no module-scope variable refs) ────────────

vi.mock('@/lib/api-auth-guard', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/db/schema/domains/member', () => ({
  organizationUsers: { userId: 'userId', role: 'role' },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', role: 'role', status: 'status' },
  organizations: { id: 'id', clerkOrganizationId: 'clerkOrganizationId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

vi.mock('@nzila/os-core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ── Imports (after mocks are established) ────────────────────────────────────

import {
  getUserRole,
  getCurrentUserRole,
  requireAuth,
  requirePermission,
  userHasPermission,
} from '../rbac-server';
import { UserRole, Permission } from '../roles';
import { auth as mockAuthRaw, currentUser as mockCurrentUserRaw } from '@/lib/api-auth-guard';
import { db as mockDbRaw } from '@/db/db';

const mockAuth = vi.mocked(mockAuthRaw);
const mockCurrentUser = vi.mocked(mockCurrentUserRaw);
const mockDbSelect = vi.mocked((mockDbRaw as any).select);

// Chainable mock for db.select().from().where().limit()
function mockSelectChain(rows: Record<string, unknown>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  return chain;
}

// ─── getUserRole ─────────────────────────────────────────────────────────────

describe('getUserRole', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PLATFORM_ADMIN_USER_IDS = '';
    process.env.SUPER_ADMIN_EMAILS = '';
  });

  afterEach(() => {
    process.env.PLATFORM_ADMIN_USER_IDS = originalEnv.PLATFORM_ADMIN_USER_IDS;
    process.env.SUPER_ADMIN_EMAILS = originalEnv.SUPER_ADMIN_EMAILS;
  });

  it('grants app_owner via PLATFORM_ADMIN_USER_IDS', async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_admin_1,user_admin_2';

    const role = await getUserRole('user_admin_1');
    expect(role).toBe(UserRole.APP_OWNER);
  });

  it('does NOT grant app_owner to non-listed user IDs', async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_admin_1';

    // Step 1 fall through (organization_users)
    const emptyChain = mockSelectChain([]);
    mockDbSelect.mockReturnValue(emptyChain as any);

    // Step 3 fallback
    mockCurrentUser.mockResolvedValue({
      publicMetadata: { role: 'member' },
    } as any);

    const role = await getUserRole('user_other');
    expect(role).toBe(UserRole.MEMBER);
  });

  it('grants app_owner via SUPER_ADMIN_EMAILS', async () => {
    // Ensure PLATFORM_ADMIN_USER_IDS does not match
    process.env.PLATFORM_ADMIN_USER_IDS = '';

    // Step 0b - currentUser returns super admin email
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'info@nzilaventures.com' }],
      publicMetadata: { role: 'member' },
    } as any);

    const role = await getUserRole('user_123');
    expect(role).toBe(UserRole.APP_OWNER);
  });

  it('resolves role from organization_users table (step 1)', async () => {
    // Email check falls through (no super admin email)
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'user@example.com' }],
      publicMetadata: {},
    } as any);

    // First select call: organization_users returns admin
    const chain = mockSelectChain([{ role: 'admin' }]);
    mockDbSelect.mockReturnValue(chain as any);

    const role = await getUserRole('user_123');
    expect(role).toBe(UserRole.ADMIN);
  });

  it('falls back to Clerk publicMetadata.role (step 3a)', async () => {
    // Step 0b: no super admin email
    // Step 1: organization_users empty
    // Step 3: metadata.role = steward
    mockCurrentUser
      .mockResolvedValueOnce({
        emailAddresses: [{ emailAddress: 'user@example.com' }],
        publicMetadata: { role: 'steward' },
      } as any)
      .mockResolvedValueOnce({
        publicMetadata: { role: 'steward' },
      } as any);

    const chain = mockSelectChain([]);
    mockDbSelect.mockReturnValue(chain as any);

    const role = await getUserRole('user_123');
    expect(role).toBe(UserRole.STEWARD);
  });

  it('resolves legacy role aliases (super_admin → admin)', async () => {
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'user@example.com' }],
      publicMetadata: {},
    } as any);

    // organization_users returns legacy 'super_admin'
    const chain = mockSelectChain([{ role: 'super_admin' }]);
    mockDbSelect.mockReturnValue(chain as any);

    const role = await getUserRole('user_123');
    expect(role).toBe(UserRole.ADMIN);
  });

  it('defaults to MEMBER when no source resolves', async () => {
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'nobody@example.com' }],
      publicMetadata: {},
    } as any);

    const chain = mockSelectChain([]);
    mockDbSelect.mockReturnValue(chain as any);

    const role = await getUserRole('user_nobody');
    expect(role).toBe(UserRole.MEMBER);
  });

  it('throws on fatal error (fail closed)', async () => {
    // currentUser throws (Clerk outage)
    mockCurrentUser.mockRejectedValue(new Error('Clerk unavailable'));

    // DB also throws
    mockDbSelect.mockImplementation(() => {
      throw new Error('DB unavailable');
    });

    await expect(getUserRole('user_123')).rejects.toThrow(
      'Authorization system unavailable',
    );
  });
});

// ─── getCurrentUserRole ──────────────────────────────────────────────────────

describe('getCurrentUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when auth() has no userId', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);

    const role = await getCurrentUserRole();
    expect(role).toBeNull();
  });
});

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any);

    await expect(requireAuth()).rejects.toThrow('Unauthorized');
  });

  it('returns userId and role when authenticated', async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_authed';
    mockAuth.mockResolvedValue({ userId: 'user_authed' } as any);

    const result = await requireAuth();
    expect(result.userId).toBe('user_authed');
    expect(result.role).toBe(UserRole.APP_OWNER);

    process.env.PLATFORM_ADMIN_USER_IDS = '';
  });
});

// ─── requirePermission ───────────────────────────────────────────────────────

describe('requirePermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when user lacks the required permission', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_member' } as any);

    // Resolve as MEMBER via PLATFORM_ADMIN_USER_IDS miss + Clerk metadata
    process.env.PLATFORM_ADMIN_USER_IDS = '';
    mockCurrentUser.mockResolvedValue({
      emailAddresses: [{ emailAddress: 'u@example.com' }],
      publicMetadata: { role: 'member' },
    } as any);
    mockDbSelect.mockReturnValue(mockSelectChain([]) as any);

    // MEMBER shouldn't have ADMIN-level permissions
    await expect(
      requirePermission(Permission.MANAGE_USERS),
    ).rejects.toThrow('Forbidden');
  });
});
