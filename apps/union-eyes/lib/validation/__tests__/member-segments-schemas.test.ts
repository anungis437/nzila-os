import { describe, it, expect } from 'vitest';
import {
  memberSegmentFiltersSchema,
  createMemberSegmentSchema,
  updateMemberSegmentSchema,
  executeMemberSearchSchema,
  executeSegmentSchema,
  exportMembersSchema,
  exportableFieldsSchema,
  paginationSchema,
  sortSchema,
} from '../member-segments-schemas';

const uuid = '00000000-0000-4000-8000-000000000001';

describe('member-segments-schemas', () => {
  // ── memberSegmentFiltersSchema (.strict()) ─────────────
  describe('memberSegmentFiltersSchema', () => {
    it('accepts empty object', () => {
      expect(memberSegmentFiltersSchema.parse({})).toEqual({});
    });

    it('accepts text search filter', () => {
      const result = memberSegmentFiltersSchema.parse({ searchQuery: 'john' });
      expect(result.searchQuery).toBe('john');
    });

    it('accepts status enum array', () => {
      const result = memberSegmentFiltersSchema.parse({
        status: ['active', 'on-leave'],
      });
      expect(result.status).toEqual(['active', 'on-leave']);
    });

    it('rejects invalid status value', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ status: ['unknown'] })
      ).toThrow();
    });

    it('accepts role enum array', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ role: ['member', 'steward'] })
      ).not.toThrow();
    });

    it('accepts uuid arrays for org structure', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({
          employerId: [uuid],
          worksiteId: [uuid],
          bargainingUnitId: [uuid],
          committeeId: [uuid],
        })
      ).not.toThrow();
    });

    it('rejects non-uuid in employerId array', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ employerId: ['bad-id'] })
      ).toThrow();
    });

    it('accepts employment status enum array', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({
          employmentStatus: ['active', 'terminated'],
        })
      ).not.toThrow();
    });

    it('accepts date range filters (YYYY-MM-DD)', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({
          joinDateFrom: '2025-01-01',
          joinDateTo: '2025-12-31',
          hireDateFrom: '2020-06-15',
          seniorityDateTo: '2024-01-01',
        })
      ).not.toThrow();
    });

    it('rejects non-YYYY-MM-DD date strings', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ joinDateFrom: '01/01/2025' })
      ).toThrow();
    });

    it('accepts seniority year ranges', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({
          seniorityYearsMin: 0,
          seniorityYearsMax: 30,
        })
      ).not.toThrow();
    });

    it('rejects negative seniority years', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ seniorityYearsMin: -1 })
      ).toThrow();
    });

    it('accepts customFields as record', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ customFields: { region: 'west' } })
      ).not.toThrow();
    });

    it('rejects unknown keys (.strict())', () => {
      expect(() =>
        memberSegmentFiltersSchema.parse({ unknownField: 'value' })
      ).toThrow();
    });

    it('accepts checkoffAuthorized boolean', () => {
      expect(
        memberSegmentFiltersSchema.parse({ checkoffAuthorized: true })
      ).toEqual({ checkoffAuthorized: true });
    });
  });

  // ── createMemberSegmentSchema ──────────────────────────
  describe('createMemberSegmentSchema', () => {
    const valid = {
      organizationId: uuid,
      name: 'Active Members',
      filters: { status: ['active'] as const },
    };

    it('accepts valid input with defaults', () => {
      const result = createMemberSegmentSchema.parse(valid);
      expect(result.isPublic).toBe(false);
    });

    it('rejects invalid organizationId', () => {
      expect(() =>
        createMemberSegmentSchema.parse({ ...valid, organizationId: 'bad' })
      ).toThrow();
    });

    it('rejects empty name', () => {
      expect(() =>
        createMemberSegmentSchema.parse({ ...valid, name: '' })
      ).toThrow();
    });

    it('rejects name > 200 chars', () => {
      expect(() =>
        createMemberSegmentSchema.parse({ ...valid, name: 'x'.repeat(201) })
      ).toThrow();
    });

    it('rejects description > 1000 chars', () => {
      expect(() =>
        createMemberSegmentSchema.parse({ ...valid, description: 'x'.repeat(1001) })
      ).toThrow();
    });

    it('validates nested filters with .strict()', () => {
      expect(() =>
        createMemberSegmentSchema.parse({
          ...valid,
          filters: { unknownField: true },
        })
      ).toThrow();
    });
  });

  // ── updateMemberSegmentSchema ──────────────────────────
  describe('updateMemberSegmentSchema', () => {
    it('accepts empty object', () => {
      expect(updateMemberSegmentSchema.parse({})).toEqual({});
    });

    it('accepts partial fields', () => {
      const result = updateMemberSegmentSchema.parse({
        name: 'Updated',
        isActive: false,
      });
      expect(result.name).toBe('Updated');
      expect(result.isActive).toBe(false);
    });
  });

  // ── executeMemberSearchSchema ──────────────────────────
  describe('executeMemberSearchSchema', () => {
    const valid = {
      organizationId: uuid,
      filters: {},
    };

    it('accepts minimal input', () => {
      expect(() => executeMemberSearchSchema.parse(valid)).not.toThrow();
    });

    it('accepts pagination and sort options', () => {
      const result = executeMemberSearchSchema.parse({
        ...valid,
        pagination: { page: 2, limit: 100 },
        sortBy: 'seniority',
        sortOrder: 'desc',
      });
      expect(result.pagination?.page).toBe(2);
      expect(result.sortBy).toBe('seniority');
    });

    it('rejects pagination limit > 1000', () => {
      expect(() =>
        executeMemberSearchSchema.parse({
          ...valid,
          pagination: { page: 1, limit: 1001 },
        })
      ).toThrow();
    });

    it('rejects invalid sortBy', () => {
      expect(() =>
        executeMemberSearchSchema.parse({ ...valid, sortBy: 'custom' })
      ).toThrow();
    });
  });

  // ── executeSegmentSchema ───────────────────────────────
  describe('executeSegmentSchema', () => {
    it('accepts valid segment id', () => {
      expect(() => executeSegmentSchema.parse({ segmentId: uuid })).not.toThrow();
    });

    it('rejects invalid segment id', () => {
      expect(() => executeSegmentSchema.parse({ segmentId: 'bad' })).toThrow();
    });

    it('applies pagination defaults', () => {
      const result = executeSegmentSchema.parse({ segmentId: uuid });
      expect(result.pagination).toBeUndefined(); // pagination is optional
    });
  });

  // ── exportMembersSchema (.refine()) ────────────────────
  describe('exportMembersSchema', () => {
    const base = {
      organizationId: uuid,
      format: 'csv' as const,
      includeFields: ['fullName'],
    };

    it('accepts with segmentId', () => {
      const result = exportMembersSchema.parse({ ...base, segmentId: uuid });
      expect(result.includeWatermark).toBe(true); // default
    });

    it('accepts with filters', () => {
      expect(() =>
        exportMembersSchema.parse({ ...base, filters: { status: ['active'] as const } })
      ).not.toThrow();
    });

    it('rejects without segmentId AND without filters (.refine())', () => {
      expect(() => exportMembersSchema.parse(base)).toThrow(
        'Must provide either segmentId or filters'
      );
    });

    it('accepts with both segmentId and filters', () => {
      expect(() =>
        exportMembersSchema.parse({
          ...base,
          segmentId: uuid,
          filters: { status: ['active'] as const },
        })
      ).not.toThrow();
    });

    it('rejects empty includeFields', () => {
      expect(() =>
        exportMembersSchema.parse({
          ...base,
          segmentId: uuid,
          includeFields: [],
        })
      ).toThrow();
    });

    it('accepts all format values', () => {
      for (const format of ['csv', 'excel', 'pdf'] as const) {
        expect(() =>
          exportMembersSchema.parse({ ...base, segmentId: uuid, format })
        ).not.toThrow();
      }
    });

    it('rejects invalid format', () => {
      expect(() =>
        exportMembersSchema.parse({ ...base, segmentId: uuid, format: 'json' })
      ).toThrow();
    });
  });

  // ── exportableFieldsSchema ─────────────────────────────
  describe('exportableFieldsSchema', () => {
    it('accepts valid field names', () => {
      expect(exportableFieldsSchema.parse('fullName')).toBe('fullName');
      expect(exportableFieldsSchema.parse('status')).toBe('status');
      expect(exportableFieldsSchema.parse('hireDate')).toBe('hireDate');
    });

    it('rejects invalid field name', () => {
      expect(() => exportableFieldsSchema.parse('invalid')).toThrow();
    });
  });

  // ── paginationSchema ──────────────────────────────────
  describe('paginationSchema', () => {
    it('applies defaults', () => {
      const result = paginationSchema.parse({});
      expect(result).toEqual({ page: 1, limit: 50 });
    });

    it('rejects page < 1', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    });

    it('rejects limit > 1000', () => {
      expect(() => paginationSchema.parse({ limit: 1001 })).toThrow();
    });
  });

  // ── sortSchema ─────────────────────────────────────────
  describe('sortSchema', () => {
    it('applies defaults', () => {
      const result = sortSchema.parse({});
      expect(result).toEqual({ sortBy: 'name', sortOrder: 'asc' });
    });

    it('accepts valid sort options', () => {
      expect(sortSchema.parse({ sortBy: 'seniority', sortOrder: 'desc' })).toEqual({
        sortBy: 'seniority',
        sortOrder: 'desc',
      });
    });

    it('rejects invalid sortBy', () => {
      expect(() => sortSchema.parse({ sortBy: 'unknown' })).toThrow();
    });
  });
});
