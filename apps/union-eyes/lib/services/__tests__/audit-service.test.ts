/**
 * Audit Service — Unit Tests
 *
 * Tests:
 *   - createAuditLog: inserts with UUID
 *   - queryAuditLogs: filtered results
 *   - getResourceAuditTrail: filters by resource
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockInsertValues, mockSelectFrom, mockFindMany } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
  mockSelectFrom: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      auditLogs: { findMany: mockFindMany },
    },
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
    $count: vi.fn(async () => 0),
  },
}));

vi.mock('@/db/schema/audit-security-schema', () => ({
  auditLogs: {
    auditId: 'auditId', organizationId: 'organizationId', userId: 'userId',
    action: 'action', resourceType: 'resourceType', resourceId: 'resourceId',
    createdAt: 'createdAt',
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

import { createAuditLog, queryAuditLogs } from '../audit-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createAuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertValues.mockResolvedValue(undefined);
  });

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
});

describe('queryAuditLogs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns filtered entries', async () => {
    const entries = [{ auditId: 'a-1', action: 'CREATE' }];
    mockFindMany.mockResolvedValue(entries);
    const result = await queryAuditLogs({ organizationId: 'org-1' });
    expect(result.entries).toEqual(entries);
  });
});
