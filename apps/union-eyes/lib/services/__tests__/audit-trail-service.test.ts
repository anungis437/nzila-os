/**
 * Audit Trail Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
}));

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema/domains/infrastructure', () => ({
  financialAuditLog: {
    id: 'id', organizationId: 'organizationId', entityType: 'entityType',
    orgId: 'orgId', action: 'action', userId: 'userId', userName: 'userName',
    timestamp: 'timestamp',
  },
}));

vi.mock('@/db/schema/audit-security-schema', () => ({
  auditLogs: { id: 'id' },
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((v: any) => Number(v)),
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

// ── Imports ──────────────────────────────────────────────────────────────────

import { AuditTrailService } from '../audit-trail-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeEntry = (overrides = {}) => ({
  id: 'aud-1', organizationId: 'org-1', entityType: 'journal_entry',
  orgId: 'je-1', action: 'create', userId: 'u-1', userName: 'Alice',
  timestamp: new Date(), ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditTrailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockInsert.mockReturnValue(chain([makeEntry()]));
    mocks.mockSelect.mockReturnValue(chain([]));
  });

  // ── logAction ──────────────────────────────────────────────────────────────
  describe('logAction', () => {
    it('inserts record and returns entry', async () => {
      const result = await AuditTrailService.logAction({
        organizationId: 'org-1', entityType: 'journal_entry', orgId: 'je-1',
        action: 'create', userId: 'u-1', userName: 'Alice',
      });
      expect(result).toBeDefined();
      expect(result.entityType).toBe('journal_entry');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logJournalEntryCreated ─────────────────────────────────────────────────
  describe('logJournalEntryCreated', () => {
    it('delegates to logAction', async () => {
      await expect(AuditTrailService.logJournalEntryCreated({
        organizationId: 'org-1', entryId: 'je-2', userId: 'u-1', userName: 'Bob',
        entry: { entryNumber: 'JE-001', totalDebit: 1000, totalCredit: 1000,
          description: 'Payroll', lines: [{ id: 1 }] },
      })).resolves.toBeUndefined();
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logJournalEntryApproved ────────────────────────────────────────────────
  describe('logJournalEntryApproved', () => {
    it('delegates with approve action', async () => {
      await AuditTrailService.logJournalEntryApproved({
        organizationId: 'org-1', entryId: 'je-1', userId: 'u-1', userName: 'Alice',
        comments: 'Approved', ipAddress: '127.0.0.1',
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logJournalEntryReversed ────────────────────────────────────────────────
  describe('logJournalEntryReversed', () => {
    it('delegates with reverse action', async () => {
      await AuditTrailService.logJournalEntryReversed({
        organizationId: 'org-1', originalEntryId: 'je-1', reversalEntryId: 'je-2',
        userId: 'u-1', userName: 'Alice', reason: 'Error correction',
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logInvoiceUpdated ──────────────────────────────────────────────────────
  describe('logInvoiceUpdated', () => {
    it('delegates with update action', async () => {
      await AuditTrailService.logInvoiceUpdated({
        organizationId: 'org-1', invoiceId: 'inv-1', userId: 'u-1', userName: 'Alice',
        changes: [{ field: 'amount', oldValue: '100', newValue: '200' }],
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logBankReconciliation ──────────────────────────────────────────────────
  describe('logBankReconciliation', () => {
    it('delegates with create action', async () => {
      await AuditTrailService.logBankReconciliation({
        organizationId: 'org-1', reconciliationId: 'rec-1', userId: 'u-1',
        userName: 'Alice', transactionCount: 50,
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logERPSync ─────────────────────────────────────────────────────────────
  describe('logERPSync', () => {
    it('delegates with sync action', async () => {
      await AuditTrailService.logERPSync({
        organizationId: 'org-1', syncJobId: 'sync-1', entityType: 'invoice',
        direction: 'push', recordsProcessed: 100, recordsSucceeded: 95, recordsFailed: 5,
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── queryAuditLog ──────────────────────────────────────────────────────────
  describe('queryAuditLog', () => {
    it('returns filtered entries', async () => {
      mocks.mockSelect.mockReturnValue(chain([makeEntry()]));
      const result = await AuditTrailService.queryAuditLog({ organizationId: 'org-1' });
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('applies optional filters', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await AuditTrailService.queryAuditLog({
        organizationId: 'org-1', entityType: 'invoice', userId: 'u-1',
        action: 'update', startDate: new Date('2026-01-01'), endDate: new Date(),
        limit: 50, offset: 10,
      });
      expect(result).toHaveLength(0);
    });
  });

  // ── getEntityHistory ───────────────────────────────────────────────────────
  describe('getEntityHistory', () => {
    it('delegates to queryAuditLog', async () => {
      mocks.mockSelect.mockReturnValue(chain([makeEntry()]));
      const result = await AuditTrailService.getEntityHistory('org-1', 'journal_entry', 'je-1');
      expect(result).toHaveLength(1);
    });
  });

  // ── getUserActivity ────────────────────────────────────────────────────────
  describe('getUserActivity', () => {
    it('delegates with date range', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await AuditTrailService.getUserActivity(
        'org-1', 'u-1', new Date('2026-01-01'), new Date(),
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── generateComplianceReport ───────────────────────────────────────────────
  describe('generateComplianceReport', () => {
    it('returns grouped report structure', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        makeEntry({ action: 'create', entityType: 'journal_entry', userId: 'u-1', userName: 'Alice', timestamp: new Date('2026-03-15T10:00:00') }),
        makeEntry({ action: 'update', entityType: 'invoice', userId: 'u-2', userName: 'Bob', timestamp: new Date('2026-03-15T11:00:00') }),
      ]));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      expect(report.totalEvents).toBe(2);
      expect(report.byAction['create']).toBe(1);
      expect(report.byAction['update']).toBe(1);
      expect(report.byUser).toHaveLength(2);
      expect(report.organizationId).toBe('org-1');
    });

    it('detects excessive deletions', async () => {
      const deletions = Array.from({ length: 12 }, (_, i) =>
        makeEntry({ id: `d-${i}`, action: 'delete', userId: 'u-bad', userName: 'Bad Actor', timestamp: new Date('2026-03-15T10:00:00') }),
      );
      mocks.mockSelect.mockReturnValue(chain(deletions));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      const sus = report.suspiciousActivities.find(s => s.type === 'excessive_deletions');
      expect(sus).toBeDefined();
      expect(sus!.severity).toBe('high');
      expect(sus!.count).toBe(12);
    });

    it('detects after-hours activity', async () => {
      const afterHours = Array.from({ length: 7 }, (_, i) =>
        makeEntry({ id: `ah-${i}`, userId: 'u-night', userName: 'Night Owl', timestamp: new Date('2026-03-15T03:00:00') }),
      );
      mocks.mockSelect.mockReturnValue(chain(afterHours));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      const sus = report.suspiciousActivities.find(s => s.type === 'after_hours_activity');
      expect(sus).toBeDefined();
      expect(sus!.severity).toBe('medium');
    });

    it('detects large modifications', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        makeEntry({
          action: 'update', userId: 'u-1', userName: 'Alice', timestamp: new Date('2026-03-15T10:00:00'),
          changes: [{ field: 'amount', oldValue: '100', newValue: '50000' }],
        }),
      ]));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      const sus = report.suspiciousActivities.find(s => s.type === 'large_modification');
      expect(sus).toBeDefined();
    });
  });

  // ── exportAuditLog ─────────────────────────────────────────────────────────
  describe('exportAuditLog', () => {
    it('exports as JSON', async () => {
      mocks.mockSelect.mockReturnValue(chain([makeEntry()]));
      const result = await AuditTrailService.exportAuditLog(
        'org-1', new Date('2026-01-01'), new Date(), 'json',
      );
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
    });

    it('exports as CSV', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        makeEntry({ timestamp: new Date('2026-03-15T10:00:00Z') }),
      ]));
      const result = await AuditTrailService.exportAuditLog(
        'org-1', new Date('2026-01-01'), new Date(), 'csv',
      );
      expect(result).toContain('Timestamp');
      expect(result).toContain('journal_entry');
    });
  });

  // ── logPrivilegedAction ────────────────────────────────────────────────────
  describe('logPrivilegedAction', () => {
    it('inserts via dynamic schema import', async () => {
      mocks.mockInsert.mockReturnValue(chain([{ id: 'pa-1' }]));
      const result = await AuditTrailService.logPrivilegedAction({
        actorId: 'u-1', actorRole: 'admin', organizationId: 'org-1',
        actionType: 'role_change', entityType: 'user', orgId: 'u-2',
        metadata: { role: 'editor' }, visibilityScope: 'admin',
      });
      expect(result).toBeDefined();
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('sanitizes sensitive metadata before insert', async () => {
      mocks.mockInsert.mockReturnValue(chain([{ id: 'pa-2' }]));
      await AuditTrailService.logPrivilegedAction({
        actorId: 'u-1', actorRole: 'admin', organizationId: 'org-1',
        actionType: 'config_update', entityType: 'settings', orgId: 'cfg-1',
        metadata: { password: 'secret123', apiKey: 'key-abc' },
        visibilityScope: 'system',
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── sanitizeMetadata ───────────────────────────────────────────────────────
  describe('sanitizeMetadata', () => {
    it('redacts sensitive keys', () => {
      const result = AuditTrailService.sanitizeMetadata({
        password: 'abc123', token: 'tok-1', apiKey: 'key-1', sin: '123-456-789',
        safeField: 'hello',
      });
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.sin).toBe('[REDACTED]');
      expect(result.safeField).toBe('hello');
    });

    it('preserves safe fields', () => {
      const result = AuditTrailService.sanitizeMetadata({
        name: 'Alice', role: 'admin', description: 'Updated config',
      });
      expect(result.name).toBe('Alice');
      expect(result.role).toBe('admin');
    });

    it('recursively sanitizes nested objects', () => {
      const result = AuditTrailService.sanitizeMetadata({
        auth: { accessToken: 'tok-1', username: 'alice' },
      });
      expect(result.auth.accessToken).toBe('[REDACTED]');
      expect(result.auth.username).toBe('alice');
    });

    it('preserves arrays', () => {
      const result = AuditTrailService.sanitizeMetadata({
        tags: ['a', 'b'],
      });
      expect(result.tags).toEqual(['a', 'b']);
    });

    /* ── Batch 32: branch gap-fill ── */

    it('recursively sanitizes nested objects', () => {
      const result = AuditTrailService.sanitizeMetadata({
        user: {
          name: 'Alice',
          secretKey: 'should-be-hidden',
        },
      });
      expect(result.user.name).toBe('Alice');
      expect(result.user.secretKey).toBe('[REDACTED]');
    });

    it('redacts SIN and SSN fields', () => {
      const result = AuditTrailService.sanitizeMetadata({
        sin: '123-456-789',
        ssn: '999-00-0000',
        normalField: 'visible',
      });
      expect(result.sin).toBe('[REDACTED]');
      expect(result.ssn).toBe('[REDACTED]');
      expect(result.normalField).toBe('visible');
    });
  });

  /* ── Batch 32: additional branch coverage ── */

  describe('getUserActivity (no date range)', () => {
    it('queries without date range', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await AuditTrailService.getUserActivity('org-1', 'u-1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('generateComplianceReport (edge cases)', () => {
    it('handles empty logs with no suspicious activities', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      expect(report.totalEvents).toBe(0);
      expect(report.suspiciousActivities).toEqual([]);
    });
  });

  describe('logPrivilegedAction', () => {
    it('logs action with metadata', async () => {
      const result = await AuditTrailService.logPrivilegedAction({
        actorId: 'u-1',
        actorRole: 'admin',
        organizationId: 'org-1',
        actionType: 'role_change',
        entityType: 'user',
        orgId: 'target-u',
        metadata: { fromRole: 'member', toRole: 'admin' },
        visibilityScope: 'admin',
      });
      expect(result).toBeDefined();
    });

    it('sanitizes metadata when present', async () => {
      await AuditTrailService.logPrivilegedAction({
        actorId: 'u-1',
        actorRole: 'admin',
        organizationId: 'org-1',
        actionType: 'config_change',
        entityType: 'settings',
        orgId: 'settings-1',
        metadata: { apiKey: 'secret123', setting: 'dark-mode' },
        visibilityScope: 'system',
      });
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  /* ── Batch 33: branch gap-fill ── */

  describe('generateComplianceReport (balance-field branch)', () => {
    it('detects large modifications via balance field', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        makeEntry({
          action: 'update', userId: 'u-1', userName: 'Alice', timestamp: new Date('2026-03-15T10:00:00'),
          changes: [{ field: 'balance', oldValue: '100', newValue: '50000' }],
        }),
      ]));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      const sus = report.suspiciousActivities.find((s: any) => (s as { type: string }).type === 'large_modification');
      expect(sus).toBeDefined();
    });

    it('ignores small balance modifications', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        makeEntry({
          action: 'update', userId: 'u-1', userName: 'Alice', timestamp: new Date('2026-03-15T10:00:00'),
          changes: [{ field: 'balance', oldValue: '100', newValue: '200' }],
        }),
      ]));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      const sus = report.suspiciousActivities.find((s: any) => (s as { type: string }).type === 'large_modification');
      expect(sus).toBeUndefined();
    });

    it('ignores update without changes array', async () => {
      mocks.mockSelect.mockReturnValue(chain([
        makeEntry({
          action: 'update', userId: 'u-1', userName: 'Alice', timestamp: new Date('2026-03-15T10:00:00'),
          changes: null,
        }),
      ]));
      const report = await AuditTrailService.generateComplianceReport(
        'org-1', new Date('2026-01-01'), new Date(),
      );
      expect(report.suspiciousActivities).toHaveLength(0);
    });
  });

  describe('logPrivilegedAction (no metadata)', () => {
    it('handles undefined metadata gracefully', async () => {
      mocks.mockInsert.mockReturnValue(chain([{ id: 'pa-3' }]));
      const result = await AuditTrailService.logPrivilegedAction({
        actorId: 'u-1', actorRole: 'admin', organizationId: 'org-1',
        actionType: 'view_data', entityType: 'report', orgId: 'rpt-1',
        visibilityScope: 'admin',
        // metadata intentionally omitted
      });
      expect(result).toBeDefined();
    });
  });
});
