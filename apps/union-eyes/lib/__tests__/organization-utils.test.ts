/**
 * Tests for organization-utils.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockCookiesGet: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizations: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    organizationType: 'organization_type',
    parentId: 'parent_id',
  },
  organizationMembers: {
    id: 'id',
    userId: 'user_id',
    organizationId: 'organization_id',
    role: 'role',
    status: 'status',
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mocks.mockCookiesGet,
  })),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    or: vi.fn(),
    relations: vi.fn(() => ({})),
  };
});

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

/** Helper: set up N sequential db.select→from→where→limit chains */
function setupLimitSequence(...values: unknown[][]) {
  let callCount = 0;
  mocks.mockLimit.mockImplementation(() => {
    const idx = Math.min(callCount, values.length - 1);
    callCount++;
    return Promise.resolve(values[idx]);
  });
}

describe('organization-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockCookiesGet.mockReturnValue(undefined);
  });

  // ── getDefaultOrganizationId ─────────────────────────────────────────

  describe('getDefaultOrganizationId', () => {
    it('returns the default organization ID constant', async () => {
      const { getDefaultOrganizationId, DEFAULT_ORGANIZATION_ID } = await import('../organization-utils');
      expect(getDefaultOrganizationId()).toBe(DEFAULT_ORGANIZATION_ID);
      expect(typeof getDefaultOrganizationId()).toBe('string');
    });
  });

  // ── validateOrganizationExists ───────────────────────────────────────

  describe('validateOrganizationExists', () => {
    it('returns true when org exists', async () => {
      mocks.mockLimit.mockResolvedValue([{ id: 'org-1' }]);
      const { validateOrganizationExists } = await import('../organization-utils');
      expect(await validateOrganizationExists('org-1')).toBe(true);
    });

    it('returns false when org does not exist', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { validateOrganizationExists } = await import('../organization-utils');
      expect(await validateOrganizationExists('nonexistent')).toBe(false);
    });

    it('returns false on DB error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('DB down'));
      const { validateOrganizationExists } = await import('../organization-utils');
      expect(await validateOrganizationExists('org-1')).toBe(false);
    });
  });

  // ── getOrganizationInfo ──────────────────────────────────────────────

  describe('getOrganizationInfo', () => {
    it('returns org info when found', async () => {
      const orgData = { id: 'org-1', name: 'Test Org', slug: 'test-org', type: 'local', parentId: null };
      mocks.mockLimit.mockResolvedValue([orgData]);
      const { getOrganizationInfo } = await import('../organization-utils');
      expect(await getOrganizationInfo('org-1')).toEqual(orgData);
    });

    it('returns null when not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { getOrganizationInfo } = await import('../organization-utils');
      expect(await getOrganizationInfo('nonexistent')).toBeNull();
    });

    it('returns null on DB error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('DB fail'));
      const { getOrganizationInfo } = await import('../organization-utils');
      expect(await getOrganizationInfo('org-1')).toBeNull();
    });
  });

  // ── userHasOrganizationAccess ────────────────────────────────────────

  describe('userHasOrganizationAccess', () => {
    it('returns true when user has access', async () => {
      mocks.mockLimit.mockResolvedValue([{ id: 'mem-1' }]);
      const { userHasOrganizationAccess } = await import('../organization-utils');
      expect(await userHasOrganizationAccess('user-1', 'org-1')).toBe(true);
    });

    it('returns false when no access', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { userHasOrganizationAccess } = await import('../organization-utils');
      expect(await userHasOrganizationAccess('user-1', 'org-1')).toBe(false);
    });

    it('returns false on DB error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('DB'));
      const { userHasOrganizationAccess } = await import('../organization-utils');
      expect(await userHasOrganizationAccess('user-1', 'org-1')).toBe(false);
    });
  });

  // ── getOrganizationIdForUser ─────────────────────────────────────────

  describe('getOrganizationIdForUser', () => {
    it('returns org from cookie when user is platform admin', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = 'admin-001';
      mocks.mockCookiesGet.mockReturnValue({ value: 'my-org' });
      // Query 1: org by slug → found
      setupLimitSequence([{ id: 'org-abc' }]);
      const { getOrganizationIdForUser } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('admin-001');
      expect(result).toBe('org-abc');
      delete process.env.PLATFORM_ADMIN_USER_IDS;
    });

    it('returns org from cookie when user is super admin', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = '';
      mocks.mockCookiesGet.mockReturnValue({ value: 'my-org' });
      // Query 1: org by slug → found
      // Query 2: super admin check → admin in default org
      setupLimitSequence(
        [{ id: 'org-abc' }],
        [{ role: 'admin' }],
      );
      const { getOrganizationIdForUser } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('user-1');
      expect(result).toBe('org-abc');
      delete process.env.PLATFORM_ADMIN_USER_IDS;
    });

    it('returns org from cookie when user has explicit membership', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = '';
      mocks.mockCookiesGet.mockReturnValue({ value: 'my-org' });
      // Query 1: org by slug → found
      // Query 2: super admin check → member (not admin access)
      // Query 3: explicit membership → found
      setupLimitSequence(
        [{ id: 'org-abc' }],
        [{ role: 'member' }],
        [{ organizationId: 'org-abc' }],
      );
      const { getOrganizationIdForUser } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('user-1');
      expect(result).toBe('org-abc');
      delete process.env.PLATFORM_ADMIN_USER_IDS;
    });

    it('falls back to first user org when cookie slug not found', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = '';
      mocks.mockCookiesGet.mockImplementation((name: string) =>
        name === 'active-organization' ? { value: 'nonexistent-slug' } : undefined,
      );
      // Query 1: org by slug → not found  →  falls through to "first org"
      // Query 2: first user org → found
      setupLimitSequence(
        [],
        [{ organizationId: 'org-first' }],
      );
      const { getOrganizationIdForUser } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('user-1');
      expect(result).toBe('org-first');
      delete process.env.PLATFORM_ADMIN_USER_IDS;
    });

    it('falls back to first org when no cookie set', async () => {
      mocks.mockCookiesGet.mockReturnValue(undefined);
      // Query 1: first user org
      setupLimitSequence([{ organizationId: 'org-first' }]);
      const { getOrganizationIdForUser } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('user-1');
      expect(result).toBe('org-first');
    });

    it('falls back to default org when user has no orgs', async () => {
      mocks.mockCookiesGet.mockReturnValue(undefined);
      // Query 1: first user org → none
      // Query 2: validate default org → exists
      setupLimitSequence([], [{ id: 'default-id' }]);
      const { getOrganizationIdForUser, DEFAULT_ORGANIZATION_ID } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('user-1');
      expect(result).toBe(DEFAULT_ORGANIZATION_ID);
    });

    it('throws when default org not found in DB', async () => {
      mocks.mockCookiesGet.mockReturnValue(undefined);
      // Query 1: first user org → none
      // Query 2: validate default org → not found → throw
      setupLimitSequence([], []);
      const { getOrganizationIdForUser } = await import('../organization-utils');
      await expect(getOrganizationIdForUser('user-1')).rejects.toThrow('not found');
    });

    it('rethrows on unexpected error', async () => {
      mocks.mockCookiesGet.mockReturnValue(undefined);
      mocks.mockLimit.mockRejectedValue(new Error('Connection lost'));
      const { getOrganizationIdForUser } = await import('../organization-utils');
      await expect(getOrganizationIdForUser('user-1')).rejects.toThrow('Connection lost');
    });

    it('falls through cookie path when no explicit membership', async () => {
      process.env.PLATFORM_ADMIN_USER_IDS = '';
      mocks.mockCookiesGet.mockImplementation((name: string) =>
        name === 'active-organization' ? { value: 'slug-x' } : undefined,
      );
      // Query 1: org by slug → found
      // Query 2: super admin check → not member of default org
      // Query 3: explicit membership → not found
      // Query 4: fall through to first user org
      setupLimitSequence(
        [{ id: 'org-x' }],
        [],
        [],
        [{ organizationId: 'org-fallback' }],
      );
      const { getOrganizationIdForUser } = await import('../organization-utils');
      const result = await getOrganizationIdForUser('user-1');
      expect(result).toBe('org-fallback');
      delete process.env.PLATFORM_ADMIN_USER_IDS;
    });
  });

  // ── getUserRoleInOrganization ────────────────────────────────────────

  describe('getUserRoleInOrganization', () => {
    it('returns mapped role for known DB role', async () => {
      mocks.mockLimit.mockResolvedValue([{ role: 'union_steward' }]);
      const { getUserRoleInOrganization } = await import('../organization-utils');
      expect(await getUserRoleInOrganization('u1', 'o1')).toBe('steward');
    });

    it('returns member for unknown DB role', async () => {
      mocks.mockLimit.mockResolvedValue([{ role: 'some_unknown_role' }]);
      const { getUserRoleInOrganization } = await import('../organization-utils');
      expect(await getUserRoleInOrganization('u1', 'o1')).toBe('member');
    });

    it('returns null when user not found in org', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { getUserRoleInOrganization } = await import('../organization-utils');
      expect(await getUserRoleInOrganization('u1', 'o1')).toBeNull();
    });

    it('returns null on DB error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('DB'));
      const { getUserRoleInOrganization } = await import('../organization-utils');
      expect(await getUserRoleInOrganization('u1', 'o1')).toBeNull();
    });

    it('maps super_admin to admin', async () => {
      mocks.mockLimit.mockResolvedValue([{ role: 'super_admin' }]);
      const { getUserRoleInOrganization } = await import('../organization-utils');
      expect(await getUserRoleInOrganization('u1', 'o1')).toBe('admin');
    });

    it('maps platform ops roles correctly', async () => {
      mocks.mockLimit.mockResolvedValue([{ role: 'cto' }]);
      const { getUserRoleInOrganization } = await import('../organization-utils');
      expect(await getUserRoleInOrganization('u1', 'o1')).toBe('cto');
    });
  });
});
