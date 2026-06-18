import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock('@/db', () => ({ db: { execute: h.execute } }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  sql: vi.fn(() => ({})),
}));

import {
  generateRemittanceCSV,
  generateRemittanceXML,
  generateStatCanExport,
  generateRemittanceFile,
  RemittanceExporter,
} from '../remittance-exporter';

beforeEach(() => {
  h.execute.mockReset();
});

const csvRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  remittance_month: 3,
  remittance_year: 2024,
  from_organization_name: 'Local 1',
  from_affiliate_code: 'AB-1',
  to_organization_name: 'National',
  to_affiliate_code: 'NA-1',
  total_members: 100,
  good_standing_members: 95,
  remittable_members: 90,
  per_capita_rate: '5.00',
  total_amount: '450.00',
  due_date: '2024-04-30',
  clc_account_code: 'CLC-1',
  gl_account: 'GL-1',
  status: 'paid',
  submitted_date: '2024-04-01',
  paid_date: '2024-04-15',
  ...overrides,
});

describe('generateRemittanceCSV', () => {
  it('produces a header plus a data row', async () => {
    h.execute.mockResolvedValueOnce([csvRow()]);
    const csv = await generateRemittanceCSV(['r1']);
    expect(csv).toContain('Remittance ID');
    expect(csv).toContain('03/2024');
    expect(csv).toContain('"Local 1"');
  });

  it('handles missing optional dates and codes', async () => {
    h.execute.mockResolvedValueOnce([csvRow({ submitted_date: null, paid_date: null, from_affiliate_code: null, to_affiliate_code: null, clc_account_code: null, gl_account: null })]);
    const csv = await generateRemittanceCSV(['r1']);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
  });
});

describe('generateRemittanceXML', () => {
  it('produces XML with submitted and paid dates', async () => {
    h.execute.mockResolvedValueOnce([{
      ...csvRow(),
      from_organization_id: 'o1',
      to_organization_id: 'o2',
      from_slug: 'local-1',
      to_slug: 'national',
    }]);
    const xml = await generateRemittanceXML(['r1']);
    expect(xml).toContain('<PerCapitaRemittances');
    expect(xml).toContain('<SubmittedDate>2024-04-01</SubmittedDate>');
    expect(xml).toContain('<PaidDate>2024-04-15</PaidDate>');
    expect(xml).toContain('<RecordCount>1</RecordCount>');
  });

  it('omits optional date elements when absent', async () => {
    h.execute.mockResolvedValueOnce([{
      ...csvRow({ submitted_date: null, paid_date: null }),
      from_organization_id: 'o1',
      to_organization_id: 'o2',
      from_slug: 'local-1',
      to_slug: 'national',
    }]);
    const xml = await generateRemittanceXML(['r1']);
    expect(xml).not.toContain('<SubmittedDate>');
    expect(xml).not.toContain('<PaidDate>');
  });
});

describe('generateStatCanExport', () => {
  it('produces header, data and trailer records across org types', async () => {
    h.execute.mockResolvedValueOnce([
      { id: 'o1', name: 'Local Union', clc_affiliate_code: 'L-1', organization_type: 'local', member_count: 120, per_capita_received: '0', per_capita_paid: '600.00', remittances_received_count: 0, remittances_paid_count: 2 },
      { id: 'o2', name: 'Mystery Org', clc_affiliate_code: null, organization_type: 'unknown-type', member_count: null, per_capita_received: '1000.50', per_capita_paid: '0', remittances_received_count: 3, remittances_paid_count: 0 },
    ]);
    const out = await generateStatCanExport(2024);
    const lines = out.split('\n');
    expect(lines[0].startsWith('H|LAB-05302|2024')).toBe(true);
    expect(lines.some((l) => l.startsWith('D|'))).toBe(true);
    expect(lines[lines.length - 1].startsWith('T|')).toBe(true);
    expect(out).toContain('UNKNOWN'); // missing affiliate code default
  });
});

describe('generateRemittanceFile', () => {
  it('routes CSV format', async () => {
    h.execute.mockResolvedValueOnce([csvRow()]);
    const r = await generateRemittanceFile({ format: 'csv', remittanceIds: ['r1'] });
    expect(r.mimeType).toBe('text/csv');
    expect(r.filename).toMatch(/\.csv$/);
  });

  it('routes XML format', async () => {
    h.execute.mockResolvedValueOnce([{ ...csvRow(), from_organization_id: 'o1', to_organization_id: 'o2', from_slug: 's1', to_slug: 's2' }]);
    const r = await generateRemittanceFile({ format: 'xml', remittanceIds: ['r1'] });
    expect(r.mimeType).toBe('application/xml');
  });

  it('routes StatCan format with a fiscal year', async () => {
    h.execute.mockResolvedValueOnce([]);
    const r = await generateRemittanceFile({ format: 'statcan', remittanceIds: [], fiscalYear: 2024 });
    expect(r.mimeType).toBe('text/plain');
    expect(r.filename).toBe('statcan-lab-05302-2024.txt');
  });

  it('throws when StatCan format lacks a fiscal year', async () => {
    await expect(generateRemittanceFile({ format: 'statcan', remittanceIds: [] })).rejects.toThrow('Fiscal year required');
  });

  it('throws for an unsupported format', async () => {
    await expect(generateRemittanceFile({ format: 'pdf' as never, remittanceIds: [] })).rejects.toThrow('Unsupported export format');
  });
});

it('exposes the RemittanceExporter facade', () => {
  expect(RemittanceExporter.generateRemittanceCSV).toBe(generateRemittanceCSV);
  expect(RemittanceExporter.generateRemittanceFile).toBe(generateRemittanceFile);
});
