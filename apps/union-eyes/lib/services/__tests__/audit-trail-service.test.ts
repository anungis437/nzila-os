/**
 * Audit Trail Service — Unit Tests
 *
 * Tests:
 *   - AuditTrailService.logAction: inserts audit record
 *   - AuditTrailService.logJournalEntryCreated: delegates to logAction
 *   - AuditTrailService.queryAuditLog: filtered results
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockInsertValues, mockReturning, mockSelectFrom } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  return {
    mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
    mockReturning,
    mockSelectFrom: vi.fn(),
  };
});

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({
      from: mockSelectFrom,
    })),
  },
}));

vi.mock('@/db/schema/domains/infrastructure', () => ({
  financialAuditLog: {
    id: 'id', organizationId: 'organizationId', entityType: 'entityType',
    orgId: 'orgId', action: 'action', userId: 'userId', userName: 'userName',
    timestamp: 'timestamp',
  },
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((v: unknown) => Number(v)),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { AuditTrailService } from '../audit-trail-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditTrailService.logAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts audit record and returns entry', async () => {
    const entry = {
      id: 'aud-1', organizationId: 'org-1', entityType: 'journal_entry',
      orgId: 'je-1', action: 'create', userId: 'u-1', userName: 'Alice',
      timestamp: new Date(),
    };
    mockReturning.mockResolvedValue([entry]);
    const result = await AuditTrailService.logAction({
      organizationId: 'org-1',
      entityType: 'journal_entry',
      orgId: 'je-1',
      action: 'create',
      userId: 'u-1',
      userName: 'Alice',
    });
    expect(result).toBeDefined();
    expect(result.entityType).toBe('journal_entry');
  });
});

describe('AuditTrailService.logJournalEntryCreated', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('delegates to logAction with journal_entry entityType', async () => {
    const entry = {
      id: 'aud-2', organizationId: 'org-1', entityType: 'journal_entry',
      orgId: 'je-2', action: 'create', userId: 'u-1', userName: 'Bob',
      timestamp: new Date(),
    };
    mockReturning.mockResolvedValue([entry]);
    await expect(
      AuditTrailService.logJournalEntryCreated({
        organizationId: 'org-1',
        entryId: 'je-2',
        userId: 'u-1',
        userName: 'Bob',
        entry: {
          entryNumber: 'JE-001',
          totalDebit: 1000,
          totalCredit: 1000,
          description: 'Monthly payroll',
          lines: [{ id: 1 }, { id: 2 }],
        },
      })
    ).resolves.toBeUndefined();
    expect(mockInsertValues).toHaveBeenCalled();
  });
});

describe('AuditTrailService.queryAuditLog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns filtered audit entries', async () => {
    const entries = [{ id: 'aud-1', action: 'create' }];
    mockSelectFrom.mockReturnValue({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => entries),
          })),
        })),
      })),
    });
    const result = await AuditTrailService.queryAuditLog({ organizationId: 'org-1' });
    expect(Array.isArray(result)).toBe(true);
  });
});
