/**
 * Audit Service — Unit Tests
 *
 * Covers: createAuditLog, queryAuditLogs, getResourceAuditTrail,
 * getUserAuditTrail, getAuditStats, archiveOldAuditLogs,
 * deleteOldAuditLogs, exportAuditLogs, auditOperation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockInsertValues, mockFindMany, mockUpdate, mockCount } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockCount: vi.fn(async () => 0),
}));

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db', () => ({
  db: {
    query: {
      auditLogs: { findMany: (...args: unknown[]) => mockFindMany(...args) },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: (...args: unknown[]) => mockUpdate(...args),
    $count: (...args: unknown[]) => mockCount(...args),
  },
}));

vi.mock('@/db/schema/audit-security-schema', () => ({
  auditLogs: {
    auditId: 'auditId', organizationId: 'organizationId', userId: 'userId',
    action: 'action', resourceType: 'resourceType', resourceId: 'resourceId',
    createdAt: 'createdAt', archived: 'archived', archivedAt: 'archivedAt',
    archivedPath: 'archivedPath',
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-1234'),
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
  createAuditLog, queryAuditLogs, getResourceAuditTrail,
  getUserAuditTrail, getAuditStats, archiveOldAuditLogs,
  deleteOldAuditLogs, exportAuditLogs, auditOperation,
} from '../audit-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('audit-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  // ── createAuditLog ─────────────────────────────────────────────────────────

  describe('createAuditLog', () => {
    it('inserts audit entry and returns UUID', async () => {
      const id = await createAuditLog({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'CREATE',
        resourceType: 'claim',
        resourceId: 'clm-1',
      });
      expect(id).toBe('mock-uuid-1234');
      expect(mockInsertValues).toHaveBeenCalled();
    });

    it('returns UUID even on insert failure', async () => {
      mockInsertValues.mockRejectedValue(new Error('DB error'));
      const id = await createAuditLog({
        organizationId: 'org-1',
        action: 'DELETE',
        resourceType: 'document',
        resourceId: 'doc-1',
      });
      expect(id).toBe('mock-uuid-1234');
    });

    it('passes metadata and ipAddress to insert', async () => {
      await createAuditLog({
        organizationId: 'org-1',
        action: 'UPDATE',
        resourceType: 'claim',
        resourceId: 'c-1',
        metadata: { field: 'status' },
        ipAddress: '1.2.3.4',
        userAgent: 'TestAgent',
      });
      const call = mockInsertValues.mock.calls[0][0];
      expect(call).toMatchObject({
        ipAddress: '1.2.3.4',
        userAgent: 'TestAgent',
      });
    });
  });

  // ── queryAuditLogs ─────────────────────────────────────────────────────────

  describe('queryAuditLogs', () => {
    it('returns filtered entries with total', async () => {
      const entries = [{ auditId: 'a-1', action: 'CREATE' }];
      mockFindMany.mockResolvedValue(entries);
      mockCount.mockResolvedValue(1);
      const result = await queryAuditLogs({ organizationId: 'org-1' });
      expect(result.entries).toEqual(entries);
      expect(result.total).toBe(1);
    });

    it('applies all optional filters', async () => {
      mockFindMany.mockResolvedValue([]);
      await queryAuditLogs({
        organizationId: 'org-1',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        userId: 'u-1',
        action: 'CREATE',
        resourceType: 'claim',
        resourceId: 'c-1',
        limit: 50,
        offset: 10,
      });
      expect(mockFindMany).toHaveBeenCalled();
    });
  });

  // ── getResourceAuditTrail ──────────────────────────────────────────────────

  describe('getResourceAuditTrail', () => {
    it('returns ordered entries for a resource', async () => {
      const entries = [
        { auditId: 'a2', action: 'UPDATE' },
        { auditId: 'a1', action: 'CREATE' },
      ];
      mockFindMany.mockResolvedValue(entries);
      const result = await getResourceAuditTrail('org-1', 'claim', 'clm-1');
      expect(result).toEqual(entries);
      expect(mockFindMany).toHaveBeenCalled();
    });
  });

  // ── getUserAuditTrail ──────────────────────────────────────────────────────

  describe('getUserAuditTrail', () => {
    it('returns entries for a user', async () => {
      const entries = [{ auditId: 'a1', userId: 'u-1' }];
      mockFindMany.mockResolvedValue(entries);
      const result = await getUserAuditTrail('org-1', 'u-1');
      expect(result).toEqual(entries);
    });

    it('respects custom limit', async () => {
      mockFindMany.mockResolvedValue([]);
      await getUserAuditTrail('org-1', 'u-1', 25);
      expect(mockFindMany).toHaveBeenCalled();
    });
  });

  // ── getAuditStats ──────────────────────────────────────────────────────────

  describe('getAuditStats', () => {
    it('aggregates statistics from entries', async () => {
      mockFindMany.mockResolvedValue([
        { action: 'CREATE', resourceType: 'claim', userId: 'u-1' },
        { action: 'CREATE', resourceType: 'document', userId: 'u-1' },
        { action: 'UPDATE', resourceType: 'claim', userId: 'u-2' },
      ]);
      const stats = await getAuditStats(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );
      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesByAction).toEqual({ CREATE: 2, UPDATE: 1 });
      expect(stats.entriesByResource).toEqual({ claim: 2, document: 1 });
      expect(stats.topUsers).toEqual([
        { userId: 'u-1', count: 2 },
        { userId: 'u-2', count: 1 },
      ]);
    });

    it('returns empty stats for no entries', async () => {
      const stats = await getAuditStats('org-1', new Date(), new Date());
      expect(stats.totalEntries).toBe(0);
      expect(stats.topUsers).toEqual([]);
    });
  });

  // ── archiveOldAuditLogs ────────────────────────────────────────────────────

  describe('archiveOldAuditLogs', () => {
    it('returns count of archived logs', async () => {
      mockUpdate.mockReturnValue(chain([{ auditId: 'a1' }, { auditId: 'a2' }]));
      const count = await archiveOldAuditLogs('org-1', new Date('2025-01-01'));
      expect(count).toBe(2);
    });

    it('accepts optional archivePath', async () => {
      mockUpdate.mockReturnValue(chain([{ auditId: 'a1' }]));
      const count = await archiveOldAuditLogs('org-1', new Date(), 's3://bucket/path');
      expect(count).toBe(1);
    });
  });

  // ── deleteOldAuditLogs ─────────────────────────────────────────────────────

  describe('deleteOldAuditLogs', () => {
    it('throws error (deprecated)', async () => {
      await expect(deleteOldAuditLogs('org-1', new Date())).rejects.toThrow(
        'Direct audit log deletion is disabled'
      );
    });
  });

  // ── exportAuditLogs ────────────────────────────────────────────────────────

  describe('exportAuditLogs', () => {
    it('returns export ID', async () => {
      mockFindMany.mockResolvedValue([{ auditId: 'a1', action: 'CREATE' }]);
      mockCount.mockResolvedValue(1);
      const id = await exportAuditLogs({ organizationId: 'org-1' });
      expect(id).toMatch(/^AUDIT-EXPORT-/);
    });
  });

  // ── auditOperation ────────────────────────────────────────────────────────

  describe('auditOperation', () => {
    it('delegates to createAuditLog', async () => {
      const id = await auditOperation(
        'org-1', 'user-1', 'CREATE', 'claim', 'c-1', 'Created claim', { priority: 'high' }
      );
      expect(id).toBe('mock-uuid-1234');
      expect(mockInsertValues).toHaveBeenCalled();
    });
  });
});
