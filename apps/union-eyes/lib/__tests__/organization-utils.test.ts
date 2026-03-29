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

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  or: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('organization-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
  });

  describe('getDefaultOrganizationId', () => {
    it('returns the default organization ID constant', async () => {
      const { getDefaultOrganizationId, DEFAULT_ORGANIZATION_ID } = await import('../organization-utils');
      expect(getDefaultOrganizationId()).toBe(DEFAULT_ORGANIZATION_ID);
      expect(typeof getDefaultOrganizationId()).toBe('string');
    });
  });

  describe('validateOrganizationExists', () => {
    it('returns true when org exists', async () => {
      mocks.mockLimit.mockResolvedValue([{ id: 'org-1' }]);
      const { validateOrganizationExists } = await import('../organization-utils');
      const result = await validateOrganizationExists('org-1');
      expect(result).toBe(true);
    });

    it('returns false when org does not exist', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { validateOrganizationExists } = await import('../organization-utils');
      const result = await validateOrganizationExists('nonexistent');
      expect(result).toBe(false);
    });

    it('returns false on DB error', async () => {
      mocks.mockLimit.mockRejectedValue(new Error('DB down'));
      const { validateOrganizationExists } = await import('../organization-utils');
      const result = await validateOrganizationExists('org-1');
      expect(result).toBe(false);
    });
  });

  describe('getOrganizationInfo', () => {
    it('returns org info when found', async () => {
      const orgData = { id: 'org-1', name: 'Test Org', slug: 'test-org', type: 'local', parentId: null };
      mocks.mockLimit.mockResolvedValue([orgData]);
      const { getOrganizationInfo } = await import('../organization-utils');
      const result = await getOrganizationInfo('org-1');
      expect(result).toEqual(orgData);
    });

    it('returns null when not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { getOrganizationInfo } = await import('../organization-utils');
      const result = await getOrganizationInfo('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('userHasOrganizationAccess', () => {
    it('returns true when user has access', async () => {
      mocks.mockLimit.mockResolvedValue([{ id: 'mem-1' }]);
      const { userHasOrganizationAccess } = await import('../organization-utils');
      const result = await userHasOrganizationAccess('user-1', 'org-1');
      expect(result).toBe(true);
    });

    it('returns false when user does not have access', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      const { userHasOrganizationAccess } = await import('../organization-utils');
      const result = await userHasOrganizationAccess('user-1', 'org-1');
      expect(result).toBe(false);
    });
  });
});
