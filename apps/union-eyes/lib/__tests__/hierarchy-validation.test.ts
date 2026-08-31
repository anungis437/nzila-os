/**
 * Hierarchy Validation Utilities — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockExecute: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    query: {
      organizations: {
        findFirst: mocks.mockFindFirst,
        findMany: mocks.mockFindMany,
      },
    },
    execute: mocks.mockExecute,
    update: mocks.mockUpdate.mockReturnValue({
      set: mocks.mockSet.mockReturnValue({
        where: mocks.mockWhere,
      }),
    }),
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizations: {
    id: 'id',
    parentId: 'parent_id',
    hierarchyPath: 'hierarchy_path',
    hierarchyLevel: 'hierarchy_level',
    organizationType: 'organization_type',
    name: 'name',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  detectCircularReference,
  findOrphanedOrganizations,
  fixOrphanedOrganizations,
  validateHierarchyDepth,
  validatePathConsistency,
  validateTypeHierarchy,
  validateOrganizationHierarchy,
  validateAllOrganizations,
  MAX_HIERARCHY_DEPTH,
  HIERARCHY_TYPES,
} from '../utils/hierarchy-validation';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('hierarchy-validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Constants ────────────────────────────────────────────────────────────

  describe('constants', () => {
    it('MAX_HIERARCHY_DEPTH is 10', () => {
      expect(MAX_HIERARCHY_DEPTH).toBe(10);
    });

    it('HIERARCHY_TYPES includes expected levels', () => {
      expect(HIERARCHY_TYPES.platform).toBe(-1);
      expect(HIERARCHY_TYPES.congress).toBe(0);
      expect(HIERARCHY_TYPES.federation).toBe(1);
      expect(HIERARCHY_TYPES.union).toBe(2);
      expect(HIERARCHY_TYPES.region).toBe(3);
      expect(HIERARCHY_TYPES.district).toBe(3);
      expect(HIERARCHY_TYPES.local).toBe(4);
    });
  });

  // ── detectCircularReference ──────────────────────────────────────────────

  describe('detectCircularReference', () => {
    it('returns valid when parentId is null', async () => {
      const result = await detectCircularReference('org-1', null);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects self-reference', async () => {
      const result = await detectCircularReference('org-1', 'org-1');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('cannot be its own parent');
    });

    it('errors when parent not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(null);
      const result = await detectCircularReference('org-1', 'org-999');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('detects circular reference via hierarchy path', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        hierarchyPath: ['root', 'org-1', 'org-2'],
        name: 'Child Org',
      });
      const result = await detectCircularReference('org-1', 'org-2');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Circular reference');
    });

    it('returns valid when no circular reference', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        hierarchyPath: ['root', 'org-2'],
        name: 'Parent Org',
      });
      const result = await detectCircularReference('org-1', 'org-2');
      expect(result.valid).toBe(true);
    });
  });

  // ── findOrphanedOrganizations ────────────────────────────────────────────

  describe('findOrphanedOrganizations', () => {
    it('returns orphaned org IDs', async () => {
      mocks.mockExecute.mockResolvedValue({
        rows: [{ id: 'orphan-1' }, { id: 'orphan-2' }],
      });
      const result = await findOrphanedOrganizations();
      expect(result).toEqual(['orphan-1', 'orphan-2']);
    });

    it('returns empty when no orphans', async () => {
      mocks.mockExecute.mockResolvedValue({ rows: [] });
      const result = await findOrphanedOrganizations();
      expect(result).toEqual([]);
    });
  });

  // ── fixOrphanedOrganizations ─────────────────────────────────────────────

  describe('fixOrphanedOrganizations', () => {
    it('returns 0 for empty array', async () => {
      const count = await fixOrphanedOrganizations([]);
      expect(count).toBe(0);
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('fixes orphans and returns count', async () => {
      mocks.mockWhere.mockResolvedValue(undefined);
      const count = await fixOrphanedOrganizations(['orphan-1', 'orphan-2']);
      expect(count).toBe(2);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  // ── validateHierarchyDepth ───────────────────────────────────────────────

  describe('validateHierarchyDepth', () => {
    it('returns valid for normal depth', () => {
      const result = validateHierarchyDepth(['a', 'b', 'c']);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('returns invalid when depth exceeds max', () => {
      const path = Array.from({ length: 11 }, (_, i) => `org-${i}`);
      const result = validateHierarchyDepth(path);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('warns when depth is close to max', () => {
      const path = Array.from({ length: 9 }, (_, i) => `org-${i}`);
      const result = validateHierarchyDepth(path);
      expect(result.valid).toBe(true);
      expect(result.warnings[0]).toContain('close to maximum');
    });

    it('no warning at safe depth', () => {
      const path = Array.from({ length: 7 }, (_, i) => `org-${i}`);
      const result = validateHierarchyDepth(path);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // ── validatePathConsistency ──────────────────────────────────────────────

  describe('validatePathConsistency', () => {
    it('validates root organization with empty (ancestors-only) path', async () => {
      const result = await validatePathConsistency('org-1', null, []);
      expect(result.valid).toBe(true);
    });

    it('rejects root with a non-empty path', async () => {
      const result = await validatePathConsistency('org-1', null, ['org-1']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Root organization');
    });

    it('errors when parent not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(null);
      const result = await validatePathConsistency('org-2', 'org-999', ['org-999']);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Parent organization not found');
    });

    it('validates correct path with parent (ancestors-only: parent id appended, not self)', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        hierarchyPath: ['root'],
        name: 'Parent',
      });
      const result = await validatePathConsistency(
        'org-2', 'org-1', ['root', 'org-1']
      );
      expect(result.valid).toBe(true);
    });

    it('detects path mismatch', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        hierarchyPath: ['root'],
        name: 'Parent',
      });
      const result = await validatePathConsistency(
        'org-2', 'org-1', ['root', 'org-3']
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('path mismatch');
    });
  });

  // ── validateTypeHierarchy ────────────────────────────────────────────────

  describe('validateTypeHierarchy', () => {
    it('valid root congress', () => {
      const result = validateTypeHierarchy('congress', null);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns for unusual root type', () => {
      const result = validateTypeHierarchy('branch', null);
      expect(result.valid).toBe(true);
      expect(result.warnings[0]).toContain('unusual');
    });

    it('valid child under higher parent', () => {
      const result = validateTypeHierarchy('local', 'federation');
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when child level <= parent level', () => {
      const result = validateTypeHierarchy('federation', 'local');
      expect(result.valid).toBe(true);
      expect(result.warnings[0]).toContain('Unusual hierarchy');
    });

    it('handles unknown org types gracefully', () => {
      const result = validateTypeHierarchy('custom_type', 'local');
      expect(result.valid).toBe(true);
      // Unknown maps to level 99, which is > local's 3
    });
  });

  // ── validateOrganizationHierarchy ────────────────────────────────────────

  describe('validateOrganizationHierarchy', () => {
    it('returns invalid when org not found', async () => {
      mocks.mockFindFirst.mockResolvedValue(null);
      const result = await validateOrganizationHierarchy('org-999');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('validates root org with correct (empty, ancestors-only) path', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: 'org-1',
        parentId: null,
        hierarchyPath: [],
        organizationType: 'congress',
      });
      const result = await validateOrganizationHierarchy('org-1');
      expect(result.valid).toBe(true);
    });

    it('validates child org with parent hierarchy checks', async () => {
      let callCount = 0;
      mocks.mockFindFirst.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // The org being validated: ancestors-only path holds the parent's id.
          return {
            id: 'org-2',
            parentId: 'org-1',
            hierarchyPath: ['org-1'],
            organizationType: 'local',
          };
        }
        // Parent org lookups (root, so its own hierarchyPath is empty)
        return {
          id: 'org-1',
          hierarchyPath: [],
          name: 'Parent',
          organizationType: 'federation',
        };
      });

      const result = await validateOrganizationHierarchy('org-2');
      expect(result.valid).toBe(true);
    });

    it('validates org with null hierarchyPath (|| [] fallback) as a valid root', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        id: 'org-1',
        parentId: null,
        hierarchyPath: null,
        organizationType: 'congress',
      });
      const result = await validateOrganizationHierarchy('org-1');
      // null path is replaced with [], which is the valid ancestors-only root path
      expect(result.valid).toBe(true);
    });
  });

  // ── Batch 35: branch gap-fill ──────────────────────────────────────────────
  describe('Batch 35: branch gap-fill', () => {
    it('validatePathConsistency with parent having null hierarchyPath (|| [] fallback)', async () => {
      mocks.mockFindFirst.mockResolvedValue({
        hierarchyPath: null,
        name: 'Parent',
      });
      const result = await validatePathConsistency('org-2', 'org-1', ['org-1']);
      // null path → [] so expected = [...[], 'org-1'] = ['org-1'] which matches
      expect(result.valid).toBe(true);
    });

    it('validateTypeHierarchy with both unknown org types uses ?? 99 fallback', () => {
      const result = validateTypeHierarchy('some_custom', 'another_custom');
      // Both map to 99, so orgLevel(99) <= parentLevel(99) → warning
      expect(result.valid).toBe(true);
      expect(result.warnings[0]).toContain('Unusual hierarchy');
    });

    it('validateAllOrganizations with all valid orgs', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { id: 'org-1', name: 'Root Org' },
      ]);
      // validateOrganizationHierarchy('org-1') → findFirst returns root org
      mocks.mockFindFirst.mockResolvedValue({
        id: 'org-1',
        parentId: null,
        hierarchyPath: [],
        organizationType: 'congress',
      });
      // findOrphanedOrganizations → execute
      mocks.mockExecute.mockResolvedValue({ rows: [] });

      const result = await validateAllOrganizations();
      expect(result.total).toBe(1);
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(0);
      expect(result.orphans).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it('validateAllOrganizations with an invalid org', async () => {
      mocks.mockFindMany.mockResolvedValue([
        { id: 'org-bad', name: 'Bad Org' },
      ]);
      // validateOrganizationHierarchy('org-bad') → org not found
      mocks.mockFindFirst.mockResolvedValue(null);
      mocks.mockExecute.mockResolvedValue({ rows: [] });

      const result = await validateAllOrganizations();
      expect(result.total).toBe(1);
      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(1);
      expect(result.issues[0].orgId).toBe('org-bad');
    });
  });
});
