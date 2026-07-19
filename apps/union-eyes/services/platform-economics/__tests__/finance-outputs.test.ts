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
  subtotal_cad: '100.00',
  discount_cad: '0.00',
  subsidy_cad: '0.00',
  total_cad: '100.00',
  status: 'issued',
  paid_amount_cad: '0.00',
  balance_due_cad: '100.00',
  period_label: 'Jan 2025',
  org_name: 'Org',
};

describe('platform-economics/finance-outputs', () => {
  describe('exportMasterInvoice', () => {
    it('exports an invoice with line items', async () => {
      h.execute.mockResolvedValueOnce([invoiceRow]); // invoice
      h.execute.mockResolvedValueOnce([
        { description: 'd', quantity: '1', unit_price_cad: '100.00', amount_cad: '100.00', cost_type: 'compute' },
      ]); // line items
      const result = await exportMasterInvoice('o1', 'inv1');
      expect(result.invoice.invoiceNumber).toBe('INV-1');
      expect(result.invoice.lineItems).toHaveLength(1);
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('throws when the invoice is missing', async () => {
      h.execute.mockResolvedValueOnce([]); // no invoice
      await expect(exportMasterInvoice('o1', 'inv1')).rejects.toThrow('not found');
    });
  });

  describe('exportAllocationStatement', () => {
    it('exports an allocation run', async () => {
      h.execute.mockResolvedValueOnce([
        { id: 'ar1', billing_period_id: 'bp1', method: 'pro_rata', total_cost_pool_cad: '500.00', period_label: 'Jan' },
      ]); // run
      h.execute.mockResolvedValueOnce([
        { local_id: 'l1', local_name: 'Local 1', basis_value: '10', share_percent: '50', allocated_amount_cad: '250.00' },
      ]); // lines
      const result = await exportAllocationStatement('o1', 'ar1');
      expect(result.method).toBe('pro_rata');
      expect(result.lines).toHaveLength(1);
    });

    it('throws when the run is missing', async () => {
      h.execute.mockResolvedValueOnce([]); // no run
      await expect(exportAllocationStatement('o1', 'ar1')).rejects.toThrow('not found');
    });
  });

  describe('exportChargebackReport', () => {
    it('exports chargebacks with totals (with period filter)', async () => {
      h.execute.mockResolvedValueOnce([
        {
          chargeback_id: 'cb1',
          period_label: 'Jan',
          gross_amount_cad: '100.00',
          subsidy_applied_cad: '10.00',
          net_amount_cad: '90.00',
          status: 'issued',
          local_name: 'Local 1',
        },
      ]);
      const result = await exportChargebackReport('o1', 'l1', 'bp1');
      expect(result.localName).toBe('Local 1');
      expect(result.totalGross).toBe('100.00');
      expect(result.totalNet).toBe('90.00');
    });

    it('handles empty chargebacks (no period filter)', async () => {
      h.execute.mockResolvedValueOnce([]);
      const result = await exportChargebackReport('o1', 'l1');
      expect(result.localName).toBe('l1');
      expect(result.totalGross).toBe('0.00');
    });
  });

  describe('exportGlJournal', () => {
    it('exports GL journal rows', async () => {
      h.execute.mockResolvedValueOnce([
        {
          date: '2025-01-01',
          account_number: '4000',
          account_name: 'Revenue',
          description: 'entry',
          debit: '100.00',
          credit: '0.00',
          cost_center: 'CC1',
          reference: 'ref1',
        },
      ]);
      const result = await exportGlJournal('o1', 'bp1');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.accountNumber).toBe('4000');
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

  describe('generateEvidencePack', () => {
    it('assembles the full evidence pack', async () => {
      // 1. invoice ids
      h.execute.mockResolvedValueOnce([{ id: 'inv1' }]);
      // 2. exportMasterInvoice: invoice + line items
      h.execute.mockResolvedValueOnce([invoiceRow]);
      h.execute.mockResolvedValueOnce([]);
      // 3. allocation ids
      h.execute.mockResolvedValueOnce([{ id: 'ar1' }]);
      // 4. exportAllocationStatement: run + lines
      h.execute.mockResolvedValueOnce([
        { id: 'ar1', billing_period_id: 'bp1', method: 'm', total_cost_pool_cad: '0.00', period_label: 'Jan' },
      ]);
      h.execute.mockResolvedValueOnce([]);
      // 5. local ids
      h.execute.mockResolvedValueOnce([{ local_id: 'l1' }]);
      // 6. exportChargebackReport
      h.execute.mockResolvedValueOnce([]);
      // 7. exportGlJournal
      h.execute.mockResolvedValueOnce([]);
      // 8. ledger summary
      h.execute.mockResolvedValueOnce([
        { total_entries: 3, total_debits: '300.00', total_credits: '0.00', net_balance: '300.00' },
      ]);

      const pack = await generateEvidencePack('o1', 'bp1');
      expect(pack.sections.invoices).toHaveLength(1);
      expect(pack.sections.allocations).toHaveLength(1);
      expect(pack.sections.ledgerSummary.totalEntries).toBe(3);
    });
  });
});
