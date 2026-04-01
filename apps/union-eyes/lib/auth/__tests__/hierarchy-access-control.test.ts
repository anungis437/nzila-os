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
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', role: 'role', status: 'status' },
  congressMemberships: { organizationId: 'organizationId', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
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

describe('validateHierarchyAccess', () => {
  it('returns not allowed when target org not found', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue(null);
    const result = await validateHierarchyAccess('user1', 'org1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Organization not found');
  });

  it('returns not allowed when user has no memberships', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local' });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    const result = await validateHierarchyAccess('user1', 'org1');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User has no organization memberships');
  });

  it('allows direct membership with correct role', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({ id: 'org1', organizationType: 'local' });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', role: 'admin', organization: { organizationType: 'local' } },
    ]);
    const result = await validateHierarchyAccess('user1', 'org1', 'read');
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe('direct');
  });

  it('allows hierarchical access for admin in parent org', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({
      id: 'child-org',
      organizationType: 'local',
      hierarchyPath: ['parent-org'],
    });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      {
        organizationId: 'parent-org',
        role: 'admin',
        organization: { organizationType: 'federation', hierarchyPath: [] },
      },
    ]);
    const result = await validateHierarchyAccess('user1', 'child-org', 'read');
    expect(result.allowed).toBe(true);
    expect(result.accessType).toBe('hierarchical');
  });

  it('denies hierarchical write access', async () => {
    mocks.mockQuery.organizations.findFirst.mockResolvedValue({
      id: 'child-org',
      organizationType: 'local',
      hierarchyPath: ['parent-org'],
    });
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      {
        organizationId: 'parent-org',
        role: 'admin',
        organization: { organizationType: 'federation', hierarchyPath: [] },
      },
    ]);
    const result = await validateHierarchyAccess('user1', 'child-org', 'write');
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

  it('requires federation hierarchy for federation sharing', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    const result = await validateSharingLevel('user1', 'org1', 'federation');
    expect(result.allowed).toBe(false);
  });

  it('allows federation sharing when org is federation type', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', organization: { organizationType: 'federation' } },
    ]);
    const result = await validateSharingLevel('user1', 'org1', 'federation');
    expect(result.allowed).toBe(true);
  });
});

describe('getAccessibleOrganizations', () => {
  it('returns empty array when user has no memberships', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([]);
    const result = await getAccessibleOrganizations('user1');
    expect(result).toEqual([]);
  });

  it('returns direct membership orgs for member role', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockResolvedValue([
      { organizationId: 'org1', role: 'member', organization: {} },
    ]);
    const result = await getAccessibleOrganizations('user1', 'read');
    expect(result).toContain('org1');
  });

  it('handles errors by returning empty array', async () => {
    mocks.mockQuery.organizationMembers.findMany.mockRejectedValue(new Error('fail'));
    const result = await getAccessibleOrganizations('user1');
    expect(result).toEqual([]);
  });
});
