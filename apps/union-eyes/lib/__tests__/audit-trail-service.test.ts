/**
 * Audit Trail Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockOrderBy: vi.fn(),
  mockLimit: vi.fn(),
  mockOffset: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema/domains/infrastructure', () => ({
  financialAuditLog: {
    organizationId: 'organization_id',
    entityType: 'entity_type',
    orgId: 'org_id',
    action: 'action',
    userId: 'user_id',
    userName: 'user_name',
    timestamp: 'timestamp',
  },
}));

vi.mock('@/db/schema/audit-security-schema', () => ({
  auditLogs: { _table: 'audit_logs' },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((v: string) => parseFloat(v) || 0),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { AuditTrailService } from '../services/audit-trail-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupInsertChain(returnRow: any) {
  mocks.mockReturning.mockResolvedValue([returnRow]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
}

function setupSelectChain(rows: any[]) {
  mocks.mockOffset.mockResolvedValue(rows);
  mocks.mockLimit.mockReturnValue({ offset: mocks.mockOffset });
  mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
  mocks.mockWhere.mockReturnValue({ orderBy: mocks.mockOrderBy });
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuditTrailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── logAction ────────────────────────────────────────────────────────────

  describe('logAction', () => {
    it('inserts audit entry and returns it', async () => {
      const entry = {
        id: 'a1',
        organizationId: 'org-1',
        entityType: 'journal_entry',
        orgId: 'je-1',
        action: 'create',
        userId: 'u1',
        userName: 'Alice',
      };
      setupInsertChain(entry);

      const result = await AuditTrailService.logAction({
        organizationId: 'org-1',
        entityType: 'journal_entry',
        orgId: 'je-1',
        action: 'create',
        userId: 'u1',
        userName: 'Alice',
      });

      expect(result.organizationId).toBe('org-1');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── logJournalEntryCreated ───────────────────────────────────────────────

  describe('logJournalEntryCreated', () => {
    it('logs journal entry creation with metadata', async () => {
      setupInsertChain({ id: 'a2', organizationId: 'org-1', entityType: 'journal_entry', action: 'create' });

      await AuditTrailService.logJournalEntryCreated({
        organizationId: 'org-1',
        entryId: 'je-1',
        userId: 'u1',
        userName: 'Alice',
        entry: {
          entryNumber: 'JE-001',
          totalDebit: 1000,
          totalCredit: 1000,
          description: 'Test',
          lines: [{ id: 1 }, { id: 2 }],
        },
      });

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'journal_entry',
          action: 'create',
          metadata: expect.objectContaining({ entryNumber: 'JE-001', lineCount: 2 }),
        }),
      );
    });
  });

  // ── logJournalEntryApproved ──────────────────────────────────────────────

  describe('logJournalEntryApproved', () => {
    it('logs approval with comments', async () => {
      setupInsertChain({ id: 'a3', organizationId: 'org-1', action: 'approve' });

      await AuditTrailService.logJournalEntryApproved({
        organizationId: 'org-1',
        entryId: 'je-1',
        userId: 'u1',
        userName: 'Bob',
        comments: 'Looks good',
      });

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'approve',
          metadata: expect.objectContaining({ comments: 'Looks good' }),
        }),
      );
    });
  });

  // ── logJournalEntryReversed ──────────────────────────────────────────────

  describe('logJournalEntryReversed', () => {
    it('logs reversal with reason and reversal entry id', async () => {
      setupInsertChain({ id: 'a4', action: 'reverse' });

      await AuditTrailService.logJournalEntryReversed({
        organizationId: 'org-1',
        originalEntryId: 'je-1',
        reversalEntryId: 'je-2',
        userId: 'u1',
        userName: 'Carol',
        reason: 'Duplicate entry',
      });

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'reverse',
          metadata: expect.objectContaining({ reversalEntryId: 'je-2', reason: 'Duplicate entry' }),
        }),
      );
    });
  });

  // ── logInvoiceUpdated ────────────────────────────────────────────────────

  describe('logInvoiceUpdated', () => {
    it('logs invoice update with changes', async () => {
      setupInsertChain({ id: 'a5', action: 'update' });

      await AuditTrailService.logInvoiceUpdated({
        organizationId: 'org-1',
        invoiceId: 'inv-1',
        userId: 'u1',
        userName: 'Dave',
        changes: [{ field: 'amount', oldValue: 100, newValue: 200 }],
      });

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'invoice',
          action: 'update',
          changes: [{ field: 'amount', oldValue: 100, newValue: 200 }],
        }),
      );
    });
  });

  // ── logBankReconciliation ────────────────────────────────────────────────

  describe('logBankReconciliation', () => {
    it('logs reconciliation with transaction count', async () => {
      setupInsertChain({ id: 'a6', action: 'create' });

      await AuditTrailService.logBankReconciliation({
        organizationId: 'org-1',
        reconciliationId: 'rec-1',
        userId: 'u1',
        userName: 'Eve',
        transactionCount: 50,
      });

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'bank_reconciliation',
          metadata: expect.objectContaining({ transactionCount: 50 }),
        }),
      );
    });
  });

  // ── logERPSync ───────────────────────────────────────────────────────────

  describe('logERPSync', () => {
    it('logs ERP sync with direction and counts', async () => {
      setupInsertChain({ id: 'a7', action: 'sync' });

      await AuditTrailService.logERPSync({
        organizationId: 'org-1',
        syncJobId: 'sync-1',
        entityType: 'invoice',
        direction: 'push',
        recordsProcessed: 100,
        recordsSucceeded: 95,
        recordsFailed: 5,
      });

      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'erp_sync',
          action: 'sync',
          userId: 'system',
          userName: 'System',
          metadata: expect.objectContaining({
            direction: 'push',
            recordsProcessed: 100,
            recordsFailed: 5,
          }),
        }),
      );
    });
  });

  // ── queryAuditLog ────────────────────────────────────────────────────────

  describe('queryAuditLog', () => {
    it('queries with minimum params', async () => {
      setupSelectChain([{ id: 'a1', organizationId: 'org-1', action: 'create' }]);

      const result = await AuditTrailService.queryAuditLog({ organizationId: 'org-1' });
      expect(result).toHaveLength(1);
      expect(result[0].organizationId).toBe('org-1');
    });

    it('applies all optional filters', async () => {
      setupSelectChain([]);

      await AuditTrailService.queryAuditLog({
        organizationId: 'org-1',
        entityType: 'invoice',
        orgId: 'inv-1',
        userId: 'u1',
        action: 'update',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        limit: 50,
        offset: 10,
      });

      expect(mocks.mockSelect).toHaveBeenCalled();
      expect(mocks.mockLimit).toHaveBeenCalledWith(50);
      expect(mocks.mockOffset).toHaveBeenCalledWith(10);
    });
  });

  // ── getEntityHistory / getUserActivity ────────────────────────────────────

  describe('getEntityHistory', () => {
    it('delegates to queryAuditLog', async () => {
      setupSelectChain([{ id: 'a1', entityType: 'invoice', orgId: 'inv-1' }]);
      const result = await AuditTrailService.getEntityHistory('org-1', 'invoice', 'inv-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserActivity', () => {
    it('delegates to queryAuditLog with dates', async () => {
      setupSelectChain([]);
      const result = await AuditTrailService.getUserActivity('org-1', 'u1', new Date(), new Date());
      expect(result).toEqual([]);
    });
  });

  // ── generateComplianceReport ─────────────────────────────────────────────

  describe('generateComplianceReport', () => {
    it('generates report with grouped data', async () => {
      const now = new Date('2026-06-15T10:00:00Z');
      setupSelectChain([
        { id: 'a1', entityType: 'invoice', action: 'create', userId: 'u1', userName: 'Alice', timestamp: now },
        { id: 'a2', entityType: 'invoice', action: 'update', userId: 'u1', userName: 'Alice', timestamp: now },
        { id: 'a3', entityType: 'journal_entry', action: 'create', userId: 'u2', userName: 'Bob', timestamp: now },
      ]);

      const report = await AuditTrailService.generateComplianceReport(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      );

      expect(report.totalEvents).toBe(3);
      expect(report.byAction['create']).toBe(2);
      expect(report.byAction['update']).toBe(1);
      expect(report.byUser).toHaveLength(2);
      expect(report.organizationId).toBe('org-1');
    });

    it('identifies excessive deletions as suspicious', async () => {
      const now = new Date('2026-06-15T10:00:00Z');
      const deletions = Array.from({ length: 12 }, (_, i) => ({
        id: `d${i}`,
        entityType: 'invoice',
        action: 'delete',
        userId: 'u1',
        userName: 'Hacker',
        timestamp: now,
      }));
      setupSelectChain(deletions);

      const report = await AuditTrailService.generateComplianceReport(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      );

      const excessiveDeletions = report.suspiciousActivities.filter(s => s.type === 'excessive_deletions');
      expect(excessiveDeletions.length).toBeGreaterThan(0);
      expect(excessiveDeletions[0].severity).toBe('high');
    });

    it('identifies after-hours activity as suspicious', async () => {
      // Use local-time constructor so getHours() reliably returns 3 (after hours)
      const lateHour = new Date(2026, 5, 15, 3, 0, 0);
      const afterHoursLogs = Array.from({ length: 6 }, (_, i) => ({
        id: `ah${i}`,
        entityType: 'invoice',
        action: 'update',
        userId: 'u1',
        userName: 'NightOwl',
        timestamp: lateHour,
      }));
      setupSelectChain(afterHoursLogs);

      const report = await AuditTrailService.generateComplianceReport(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      );

      const afterHours = report.suspiciousActivities.filter(s => s.type === 'after_hours_activity');
      expect(afterHours.length).toBeGreaterThan(0);
    });

    it('identifies large financial modifications', async () => {
      const now = new Date('2026-06-15T10:00:00Z');
      setupSelectChain([
        {
          id: 'lm1',
          entityType: 'invoice',
          orgId: 'inv-1',
          action: 'update',
          userId: 'u1',
          userName: 'Spender',
          timestamp: now,
          changes: [{ field: 'amount', oldValue: '100', newValue: '20000' }],
        },
      ]);

      const report = await AuditTrailService.generateComplianceReport(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
      );

      const largeMods = report.suspiciousActivities.filter(s => s.type === 'large_modification');
      expect(largeMods.length).toBeGreaterThan(0);
    });
  });

  // ── exportAuditLog ───────────────────────────────────────────────────────

  describe('exportAuditLog', () => {
    it('exports as JSON', async () => {
      const now = new Date('2026-06-15T10:00:00Z');
      setupSelectChain([{ id: 'a1', entityType: 'invoice', action: 'create', timestamp: now }]);

      const result = await AuditTrailService.exportAuditLog(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        'json',
      );

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
    });

    it('exports as CSV with headers', async () => {
      const now = new Date('2026-06-15T10:00:00Z');
      setupSelectChain([
        {
          id: 'a1',
          entityType: 'invoice',
          orgId: 'inv-1',
          action: 'create',
          userId: 'u1',
          userName: 'Alice',
          timestamp: now,
          ipAddress: '1.2.3.4',
          changes: [],
        },
      ]);

      const result = await AuditTrailService.exportAuditLog(
        'org-1',
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        'csv',
      );

      expect(result).toContain('Timestamp');
      expect(result).toContain('Entity Type');
      expect(result).toContain('"invoice"');
    });
  });

  // ── logPrivilegedAction ──────────────────────────────────────────────────

  describe('logPrivilegedAction', () => {
    it('inserts into auditLogs table with sanitized metadata', async () => {
      setupInsertChain({ id: 'pa1', action: 'role_change' });

      const result = await AuditTrailService.logPrivilegedAction({
        actorId: 'u1',
        actorRole: 'admin',
        organizationId: 'org-1',
        actionType: 'role_change',
        entityType: 'user',
        orgId: 'u2',
        metadata: { newRole: 'treasurer', password: 'secret123' },
        visibilityScope: 'admin',
      });

      expect(result).toBeDefined();
      // Password should be redacted in metadata
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            newRole: 'treasurer',
            password: '[REDACTED]',
          }),
        }),
      );
    });
  });

  // ── sanitizeMetadata ─────────────────────────────────────────────────────

  describe('sanitizeMetadata', () => {
    it('redacts sensitive keys', () => {
      const result = AuditTrailService.sanitizeMetadata({
        name: 'Alice',
        password: 'secret',
        apiKey: 'key-123',
        token: 'tok',
        normal: 'visible',
      });

      expect(result.name).toBe('Alice');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.normal).toBe('visible');
    });

    it('recursively sanitizes nested objects', () => {
      const result = AuditTrailService.sanitizeMetadata({
        user: { name: 'Bob', secretKey: 'xxx' },
      });

      expect(result.user.name).toBe('Bob');
      expect(result.user.secretKey).toBe('[REDACTED]');
    });

    it('preserves arrays', () => {
      const result = AuditTrailService.sanitizeMetadata({
        roles: ['admin', 'member'],
      });
      expect(result.roles).toEqual(['admin', 'member']);
    });

    it('redacts SIN/SSN and financial identifiers', () => {
      const result = AuditTrailService.sanitizeMetadata({
        sin: '123456789',
        ssn: '999-99-9999',
        creditCard: '4242424242424242',
        cvv: '123',
      });

      expect(result.sin).toBe('[REDACTED]');
      expect(result.ssn).toBe('[REDACTED]');
      expect(result.creditCard).toBe('[REDACTED]');
      expect(result.cvv).toBe('[REDACTED]');
    });
  });
});
