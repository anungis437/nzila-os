import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const execute = vi.fn();
  const auditLog = vi.fn();
  return { execute, auditLog };
});

vi.mock('@/db', () => ({ db: { execute: h.execute } }));
vi.mock('drizzle-orm', async (orig) => {
  const sqlTag = Object.assign(
    (..._args: unknown[]) => ({ __sql: true }),
    { raw: vi.fn(() => ({})) },
  );
  return { ...(await orig<Record<string, unknown>>()), sql: sqlTag };
});
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_EXPORT: 'data_export' },
  AuditSeverity: { MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' },
}));

import { ErrorCode } from '@/lib/api/errors';
import { BaseFinancialCapabilityUnavailable } from '@/lib/finance/base-release-boundary';
import {
  exportAllocationStatement,
  exportChargebackReport,
  exportGlJournal,
  exportMasterInvoice,
  generateEvidencePack,
  glJournalToCsv,
} from '../finance-outputs';

beforeEach(() => {
  h.execute.mockReset();
  h.auditLog.mockReset();
});

const invoiceRow = {
  id: 'inv1',
  invoice_number: 'INV-1',
  billing_period_id: 'bp1',
  issue_date: '2025-01-01',
  due_date: '2025-01-31',
  subtotal: '100.00',
  tax_amount: '0.00',
  total_amount: '100.00',
  status: 'issued',
  currency: 'CAD',
  amount_paid: '0.00',
  balance_due: '100.00',
  period_label: 'Jan 2025',
  org_name: 'Org',
};

describe('platform-economics/finance-outputs', () => {
  // Finance and dues persistence are excluded from the base release: every export refuses before any query or audit.
  describe.each([
    ['exportMasterInvoice', () => exportMasterInvoice('o1', 'inv1')],
    ['exportAllocationStatement', () => exportAllocationStatement('o1', 'ar1')],
    ['exportChargebackReport (with period filter)', () => exportChargebackReport('o1', 'l1', 'bp1')],
    ['exportChargebackReport (no period filter)', () => exportChargebackReport('o1', 'l1')],
    ['exportGlJournal', () => exportGlJournal('o1', 'bp1')],
    ['generateEvidencePack', () => generateEvidencePack('o1', 'bp1')],
  ])('%s', (_name, call) => {
    it('is refused with 501 NOT_IMPLEMENTED and touches neither the database nor the audit log', async () => {
      h.execute.mockResolvedValue([invoiceRow]);
      const refusal = await call().then(
        () => null,
        (error: unknown) => error,
      );
      expect(refusal).toBeInstanceOf(BaseFinancialCapabilityUnavailable);
      expect(refusal).toMatchObject({
        status: 501,
        code: ErrorCode.NOT_IMPLEMENTED,
        message: 'Finance and dues persistence are not available in this release.',
      });
      expect(h.execute).not.toHaveBeenCalled();
      expect(h.auditLog).not.toHaveBeenCalled();
    });
  });

  describe('glJournalToCsv', () => {
    it('converts journal rows to CSV with escaping', () => {
      const csv = glJournalToCsv({
        meta: {} as never,
        rows: [
          {
            date: '2025-01-01',
            accountNumber: '4000',
            accountName: 'Rev "Main"',
            description: 'line, with comma',
            debit: '100.00',
            credit: '0.00',
            costCenter: 'CC1',
            reference: 'ref1',
          },
        ],
      });
      const lines = csv.split('\n');
      expect(lines[0]).toContain('Date,Account Number');
      expect(lines[1]).toContain('"Rev ""Main"""');
    });
  });
});
