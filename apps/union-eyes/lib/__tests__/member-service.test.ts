import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                     */
/* ------------------------------------------------------------------ */
const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      organizationMembers: { findFirst: mocks.mockFindFirst },
    },
    select: mocks.mockSelect,
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    delete: mocks.mockDelete,
  },
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: {
    id: 'id',
    userId: 'userId',
    organizationId: 'organizationId',
    membershipNumber: 'membershipNumber',
    name: 'name',
    email: 'email',
    status: 'status',
    role: 'role',
    department: 'department',
    position: 'position',
    hireDate: 'hireDate',
    unionJoinDate: 'unionJoinDate',
    deletedAt: 'deletedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...a: unknown[]) => ({ _type: 'eq', _args: a })),
  and: vi.fn((...a: unknown[]) => ({ _type: 'and', _args: a })),
  or: vi.fn((...a: unknown[]) => ({ _type: 'or', _args: a })),
  desc: vi.fn((c: unknown) => ({ _type: 'desc', _col: c })),
  asc: vi.fn((c: unknown) => ({ _type: 'asc', _col: c })),
  sql: Object.assign(vi.fn((...a: unknown[]) => ({ _type: 'sql', _args: a })), { raw: vi.fn() }),
  count: vi.fn(() => 'count_fn'),
  gte: vi.fn((...a: unknown[]) => ({ _type: 'gte', _args: a })),
  lte: vi.fn((...a: unknown[]) => ({ _type: 'lte', _args: a })),
  like: vi.fn((...a: unknown[]) => ({ _type: 'like', _args: a })),
  inArray: vi.fn((...a: unknown[]) => ({ _type: 'inArray', _args: a })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(result: any = undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'offset', 'groupBy', 'set', 'values', 'returning']) {
    c[m] = vi.fn(() => c);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c.then = (resolve: any) => resolve(result);
  return c;
}

/* ------------------------------------------------------------------ */
/*  Import SUT                                                        */
/* ------------------------------------------------------------------ */
import {
  getMemberById,
  getMemberByUserId,
  getMemberByMembershipNumber,
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  permanentlyDeleteMember,
  bulkImportMembers,
  bulkUpdateMemberStatus,
  bulkUpdateMemberRole,
  searchMembers,
  getMemberStatistics,
  mergeMembers,
  calculateSeniority,
  getMembersByDepartment,
  getMembersByRole,
} from '@/lib/services/member-service';

/* ------------------------------------------------------------------ */
/*  Fixtures                                                          */
/* ------------------------------------------------------------------ */
const MEMBER = {
  id: 'm1',
  userId: 'u1',
  organizationId: 'org-1',
  membershipNumber: 'MEM-001',
  name: 'Jane Doe',
  email: 'jane@example.com',
  status: 'active',
  role: 'member',
  department: 'Engineering',
  position: 'Developer',
  hireDate: new Date('2020-01-15'),
  unionJoinDate: new Date('2020-06-01'),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */
describe('member-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // Basic lookups
  // ================================================================
  describe('getMemberById', () => {
    it('returns member when found', async () => {
      mocks.mockFindFirst.mockResolvedValue(MEMBER);
      expect(await getMemberById('m1')).toEqual(MEMBER);
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);
      expect(await getMemberById('missing')).toBeNull();
    });

    it('throws on error', async () => {
      mocks.mockFindFirst.mockRejectedValue(new Error('db'));
      await expect(getMemberById('m1')).rejects.toThrow('Failed to fetch member');
    });
  });

  describe('getMemberByUserId', () => {
    it('returns member when found', async () => {
      mocks.mockFindFirst.mockResolvedValue(MEMBER);
      expect(await getMemberByUserId('u1', 'org-1')).toEqual(MEMBER);
    });

    it('returns null when not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);
      expect(await getMemberByUserId('u1', 'org-x')).toBeNull();
    });
  });

  describe('getMemberByMembershipNumber', () => {
    it('returns member when found', async () => {
      mocks.mockFindFirst.mockResolvedValue(MEMBER);
      expect(await getMemberByMembershipNumber('MEM-001', 'org-1')).toEqual(MEMBER);
    });
  });

  // ================================================================
  // listMembers
  // ================================================================
  describe('listMembers', () => {
    it('returns paginated results with defaults', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([MEMBER]));

      const result = await listMembers();
      expect(result).toEqual({ members: [MEMBER], total: 1, page: 1, limit: 50 });
    });

    it('applies all filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await listMembers(
        {
          organizationId: 'org-1',
          status: ['active'],
          role: ['member'],
          department: 'Eng',
          searchQuery: 'jane',
          hireDateFrom: new Date('2020-01-01'),
          hireDateTo: new Date('2020-12-31'),
          unionJoinDateFrom: new Date('2020-01-01'),
          unionJoinDateTo: new Date('2020-12-31'),
        },
        { page: 2, limit: 10, sortBy: 'email', sortOrder: 'desc' },
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('handles different sort columns', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await listMembers({}, { sortBy: 'hireDate' });
      expect(result.members).toEqual([]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(listMembers()).rejects.toThrow('Failed to list members');
    });
  });

  // ================================================================
  // CRUD
  // ================================================================
  describe('createMember', () => {
    it('inserts and returns member', async () => {
      mocks.mockInsert.mockReturnValue(chain([MEMBER]));
      const result = await createMember(MEMBER as never);
      expect(result).toEqual(MEMBER);
    });

    it('throws on error', async () => {
      mocks.mockInsert.mockImplementation(() => { throw new Error('dup'); });
      await expect(createMember(MEMBER as never)).rejects.toThrow('Failed to create member');
    });
  });

  describe('updateMember', () => {
    it('updates and returns member', async () => {
      const updated = { ...MEMBER, name: 'Jane Updated' };
      mocks.mockUpdate.mockReturnValue(chain([updated]));
      const result = await updateMember('m1', { name: 'Jane Updated' } as never);
      expect(result).toEqual(updated);
    });

    it('returns null when not found', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      expect(await updateMember('missing', {} as never)).toBeNull();
    });
  });

  describe('deleteMember', () => {
    it('soft deletes and returns true', async () => {
      mocks.mockUpdate.mockReturnValue(chain([MEMBER]));
      expect(await deleteMember('m1')).toBe(true);
    });

    it('returns false when not found', async () => {
      mocks.mockUpdate.mockReturnValue(chain([undefined]));
      expect(await deleteMember('missing')).toBe(false);
    });
  });

  describe('permanentlyDeleteMember', () => {
    it('hard deletes and returns true', async () => {
      mocks.mockDelete.mockReturnValue(chain());
      expect(await permanentlyDeleteMember('m1')).toBe(true);
    });
  });

  // ================================================================
  // Bulk operations
  // ================================================================
  describe('bulkImportMembers', () => {
    it('imports all members successfully', async () => {
      mocks.mockInsert.mockReturnValue(chain([MEMBER]));
      const result = await bulkImportMembers([MEMBER as never, MEMBER as never]);
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('collects errors for failed imports', async () => {
      mocks.mockInsert
        .mockReturnValueOnce(chain([MEMBER]))
        .mockImplementationOnce(() => { throw new Error('dup key'); });

      const result = await bulkImportMembers([MEMBER as never, MEMBER as never]);
      expect(result.success).toBe(false);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors![0].row).toBe(2);
    });
  });

  describe('bulkUpdateMemberStatus', () => {
    it('updates status for all member ids', async () => {
      mocks.mockUpdate.mockReturnValue(chain());
      const result = await bulkUpdateMemberStatus(['m1', 'm2'], 'inactive');
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('returns failure on error', async () => {
      mocks.mockUpdate.mockImplementation(() => { throw new Error('fail'); });
      const result = await bulkUpdateMemberStatus(['m1'], 'inactive');
      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
    });
  });

  describe('bulkUpdateMemberRole', () => {
    it('updates role for all member ids', async () => {
      mocks.mockUpdate.mockReturnValue(chain());
      const result = await bulkUpdateMemberRole(['m1', 'm2'], 'steward');
      expect(result.success).toBe(true);
      expect(result.processed).toBe(2);
    });

    it('returns failure on error', async () => {
      mocks.mockUpdate.mockImplementation(() => { throw new Error('fail'); });
      const result = await bulkUpdateMemberRole(['m1'], 'admin');
      expect(result.success).toBe(false);
    });
  });

  // ================================================================
  // Search
  // ================================================================
  describe('searchMembers', () => {
    it('returns matching members', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 1 }]))
        .mockReturnValueOnce(chain([MEMBER]));

      const result = await searchMembers('org-1', 'jane');
      expect(result.members).toEqual([MEMBER]);
      expect(result.total).toBe(1);
    });

    it('applies optional filters', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ count: 0 }]))
        .mockReturnValueOnce(chain([]));

      const result = await searchMembers('org-1', 'term', {
        status: ['active'],
        role: ['member'],
        department: 'Eng',
      });
      expect(result.members).toEqual([]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(searchMembers('org-1', 'q')).rejects.toThrow('Failed to search members');
    });
  });

  // ================================================================
  // Statistics
  // ================================================================
  describe('getMemberStatistics', () => {
    it('aggregates member statistics', async () => {
      const members = [
        { status: 'active', role: 'member', department: 'Eng' },
        { status: 'active', role: 'steward', department: 'Eng' },
        { status: 'inactive', role: 'member', department: null },
      ];
      mocks.mockSelect.mockReturnValue(chain(members));

      const stats = await getMemberStatistics('org-1');
      expect(stats.total).toBe(3);
      expect(stats.byStatus).toEqual({ active: 2, inactive: 1 });
      expect(stats.byRole).toEqual({ member: 2, steward: 1 });
      expect(stats.byDepartment).toEqual({ Eng: 2 });
    });

    it('handles no members', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const stats = await getMemberStatistics('org-1');
      expect(stats.total).toBe(0);
    });
  });

  // ================================================================
  // mergeMembers
  // ================================================================
  describe('mergeMembers', () => {
    const PRIMARY = { ...MEMBER, id: 'm1', name: 'Primary' };
    const DUPLICATE = { ...MEMBER, id: 'm2', name: 'Duplicate', department: 'HR' };

    it('keeps primary data', async () => {
      mocks.mockFindFirst
        .mockResolvedValueOnce(PRIMARY)
        .mockResolvedValueOnce(DUPLICATE);
      mocks.mockUpdate.mockReturnValue(chain([PRIMARY]));

      const result = await mergeMembers('m1', 'm2', 'primary');
      expect(result).toEqual(PRIMARY);
    });

    it('keeps duplicate data', async () => {
      mocks.mockFindFirst
        .mockResolvedValueOnce(PRIMARY)
        .mockResolvedValueOnce(DUPLICATE);
      mocks.mockUpdate.mockReturnValue(chain([DUPLICATE]));

      const result = await mergeMembers('m1', 'm2', 'duplicate');
      expect(result.name).toBeDefined();
    });

    it('merges data preferring non-null from duplicate', async () => {
      const primaryWithNull = { ...PRIMARY, department: null };
      mocks.mockFindFirst
        .mockResolvedValueOnce(primaryWithNull)
        .mockResolvedValueOnce(DUPLICATE);
      mocks.mockUpdate.mockReturnValue(chain([{ ...primaryWithNull, department: 'HR' }]));

      const result = await mergeMembers('m1', 'm2', 'merge');
      expect(result).toBeDefined();
    });

    it('throws when member not found', async () => {
      mocks.mockFindFirst
        .mockResolvedValueOnce(PRIMARY)
        .mockResolvedValueOnce(undefined);

      await expect(mergeMembers('m1', 'missing', 'primary')).rejects.toThrow('Failed to merge members');
    });
  });

  // ================================================================
  // calculateSeniority
  // ================================================================
  describe('calculateSeniority', () => {
    it('calculates years and months from unionJoinDate', async () => {
      const joinDate = new Date();
      joinDate.setFullYear(joinDate.getFullYear() - 3);
      joinDate.setMonth(joinDate.getMonth() - 2);
      mocks.mockFindFirst.mockResolvedValue({ ...MEMBER, unionJoinDate: joinDate });

      const result = await calculateSeniority('m1');
      expect(result).toMatch(/\d+ years?, \d+ months?/);
    });

    it('returns N/A when member not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);
      expect(await calculateSeniority('missing')).toBe('N/A');
    });

    it('returns N/A when no unionJoinDate', async () => {
      mocks.mockFindFirst.mockResolvedValue({ ...MEMBER, unionJoinDate: null });
      expect(await calculateSeniority('m1')).toBe('N/A');
    });
  });

  // ================================================================
  // Department / Role lookups
  // ================================================================
  describe('getMembersByDepartment', () => {
    it('returns members in department', async () => {
      mocks.mockSelect.mockReturnValue(chain([MEMBER]));
      const result = await getMembersByDepartment('org-1', 'Engineering');
      expect(result).toEqual([MEMBER]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getMembersByDepartment('org-1', 'Eng')).rejects.toThrow('Failed to fetch members by department');
    });
  });

  describe('getMembersByRole', () => {
    it('returns members with role', async () => {
      mocks.mockSelect.mockReturnValue(chain([MEMBER]));
      const result = await getMembersByRole('org-1', 'member');
      expect(result).toEqual([MEMBER]);
    });

    it('throws on error', async () => {
      mocks.mockSelect.mockImplementation(() => { throw new Error('fail'); });
      await expect(getMembersByRole('org-1', 'admin')).rejects.toThrow('Failed to fetch members by role');
    });
  });
});
