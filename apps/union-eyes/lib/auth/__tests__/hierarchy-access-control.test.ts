import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockQuery: {
    organizations: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    organizationMembers: {
      findMany: vi.fn(),
    },
  },
  mockSelect: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: mocks.mockQuery,
    select: mocks.mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  organizations: { id: 'id', parentId: 'parentId', organizationType: 'organizationType', clcAffiliated: 'clcAffiliated', hierarchyPath: 'hierarchyPath' },
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', role: 'role', status: 'status', deletedAt: 'deletedAt' },
  congressMemberships: { organizationId: 'organizationId', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  isNull: vi.fn((column: unknown) => ['isNull', column]),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  validateHierarchyAccess,
  validateSharingLevel,
  getAccessibleOrganizations,
} from '../hierarchy-access-control';

beforeEach(() => {
  vi.clearAllMocks();
});

const ACTIVE = { status: 'active' };

/** The membership predicate the module handed the database, flattened. */
const membershipPredicate = () => JSON.stringify(mocks.mockQuery.organizationMembers.findMany.mock.calls.at(-1)?.[0]?.where);

describe('validateHierarchyAccess', () => {
  it('returns not allowed when target org not found', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue(null);
    const result = await validateHierarchyAccess('user1', 'org1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Organization not found');
  });

  it('answers not found for an archived or suspended organization, even to its own administrator', async () => {
    for (const status of ['archived', 'suspended', 'inactive']) {
      mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local', status });
      mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
        { organizationId: 'org1', role: 'admin', status: 'active', organization: { organizationType: 'local', status } },
      ]);
      const result = await validateHierarchyAccess('user1', 'org1', 'read');
      expect(result).toEqual({ allowed: false, reason: 'Organization not found' });
    }
  });

  it('returns not allowed when user has no live membership of the organization', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local', ...ACTIVE });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    const result = await validateHierarchyAccess('user1', 'org1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User has no live membership of this organization');
  });

  it('asks only for an active, non-deleted membership of exactly the target organization', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local', ...ACTIVE });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    await validateHierarchyAccess('user1', 'org1');
    const where = membershipPredicate();
    expect(where).toContain('["userId","user1"]');
    expect(where).toContain('["status","active"]');
    expect(where).toContain('["isNull","deletedAt"]');
    expect(where).toContain('["organizationId","org1"]');
  });

  it('allows direct membership with correct role', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local', ...ACTIVE });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', role: 'admin', status: 'active', organization: { organizationType: 'local', ...ACTIVE } },
    ]);
    const result = await validateHierarchyAccess('user1', 'org1', 'read');
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe('direct');
  });

  it('denies a direct member whose role does not permit the action', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local', ...ACTIVE });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', role: 'member', status: 'active', organization: { organizationType: 'local', ...ACTIVE } },
    ]);
    const result = await validateHierarchyAccess('user1', 'org1', 'write');
    expect(result.allowed).toBe(false);
  });

  // #1116: the hierarchy is an affiliation graph, not an ACL.
  it.each(['read', 'share', 'write', 'admin'] as const)('denies %s to an administrator of a parent organization', async (action) => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({
      id: 'child-org',
      organizationType: 'local',
      hierarchyPath: ['parent-org'],
      ...ACTIVE,
    });
    // The membership query is scoped to the target organization, so a parent membership is never returned.
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    const result = await validateHierarchyAccess('user1', 'child-org', action);
    expect(result.allowed).toBe(false);
    expect(result.accessType).toBeUndefined();
  });

  it('denies an administrator of a child organization reading its parent, even if a broader membership row is returned', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'parent-org', organizationType: 'federation', hierarchyPath: [], ...ACTIVE });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'child-org', role: 'admin', status: 'active', organization: { organizationType: 'local', hierarchyPath: ['parent-org'], ...ACTIVE } },
    ]);
    const result = await validateHierarchyAccess('user1', 'parent-org', 'read');
    expect(result.allowed).toBe(false);
  });

  it('handles errors gracefully', async () => {
    mocks.mockQuery.organizations.findFirst.mockRejectedValue(new Error('DB down'));
    const result = await validateHierarchyAccess('user1', 'org1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Access validation failed');
  });
});

describe('validateSharingLevel', () => {
  it('allows public sharing for all', async () => {
    const result = await validateSharingLevel('user1', 'org1', 'public');
    expect(result.allowed).toBe(true);
  });

  it('allows private sharing', async () => {
    const result = await validateSharingLevel('user1', 'org1', 'private');
    expect(result.allowed).toBe(true);
  });

  // #1116: no ratified cross-organization sharing instrument exists, so federation and congress sharing are denied by default.
  it.each(['federation', 'congress'] as const)('denies %s sharing by default, even for a member of a federation-type organization', async (level) => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', role: 'admin', status: 'active', organization: { organizationType: 'federation', clcAffiliated: true, ...ACTIVE } },
    ]);
    const result = await validateSharingLevel('user1', 'org1', level);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/denied/);
    expect(mocks.mockSelect).not.toHaveBeenCalled();
  });
});

describe('getAccessibleOrganizations', () => {
  it('returns empty array when user has no memberships', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    const result = await getAccessibleOrganizations('user1');
    expect(result).toEqual([]);
  });

  it('returns direct membership orgs for member role, from live memberships only', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', role: 'member', status: 'active', organization: { ...ACTIVE } },
    ]);
    const result = await getAccessibleOrganizations('user1', 'read');
    expect(result).toEqual(['org1']);
    const where = membershipPredicate();
    expect(where).toContain('["status","active"]');
    expect(where).toContain('["isNull","deletedAt"]');
  });

  it('never adds child organizations for an administrator, and never reads the hierarchy', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'parent-org', role: 'admin', status: 'active', organization: { hierarchyPath: ['parent-org'], ...ACTIVE } },
    ]);
    mocks.mockQuery.organizations.findMany.mockResolvedValue([{ id: 'child-org' }]);
    const result = await getAccessibleOrganizations('user1', 'read');
    expect(result).toEqual(['parent-org']);
    expect(mocks.mockQuery.organizations.findMany).not.toHaveBeenCalled();
  });

  it('omits an organization that is not active, or whose organization row is absent', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'archived-org', role: 'admin', status: 'active', organization: { status: 'archived' } },
      { organizationId: 'orphan-org', role: 'admin', status: 'active' },
    ]);
    expect(await getAccessibleOrganizations('user1', 'read')).toEqual([]);
  });

  it('handles errors by returning empty array', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockRejectedValue(new Error('fail'));
    const result = await getAccessibleOrganizations('user1');
    expect(result).toEqual([]);
  });
});
