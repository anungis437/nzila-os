import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  return { queue, db: { select: () => makeChain() }, genExcel: vi.fn(async () => Buffer.from('xlsx-bytes')) };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/utils/excel-generator', () => ({ generateRemittanceExcel: h.genExcel }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));

import { RemittanceExportService, remittanceExporter } from '../remittance-export';

const push = (...items: unknown[]) => h.queue.push(...items);
const svc = new RemittanceExportService();

const mkResult = (over: { remittance?: Record<string, unknown>; fromOrg?: Record<string, unknown> } = {}) => ({
  remittance: {
    id: 'r1', toOrganizationId: 'p1', fromOrganizationId: 'o1',
    remittanceYear: 2024, remittanceMonth: 3, remittableMembers: 90,
    perCapitaRate: '5.00', totalAmount: '450.00', status: 'paid',
    dueDate: '2024-04-30', paidDate: '2024-04-15', clcAccountCode: 'CLC-1',
    glAccount: 'GL-1', notes: 'n,ote', ...over.remittance,
  },
  fromOrg: { id: 'o1', name: 'Local & 1', code: 'CH-1', ...over.fromOrg },
});
const parent = (over: Record<string, unknown> = {}) => ({ id: 'p1', name: 'National', charterNumber: 'NA-1', ...over });

const fullOpts = { remittanceIds: ['r1'], parentOrgId: 'p1', periodStart: new Date('2024-01-01'), periodEnd: new Date('2024-12-31') };

beforeEach(() => {
  h.queue.length = 0;
  h.genExcel.mockClear();
});

describe('exportRemittances format routing', () => {
  it('generates a CSV export with full metadata and all query conditions', async () => {
    push([mkResult()], [parent()]);
    const file = await svc.exportRemittances({ format: 'csv', ...fullOpts });
    expect(file.format).toBe('csv');
    expect(file.mimeType).toBe('text/csv');
    expect(file.recordCount).toBe(1);
    expect(file.totalAmount).toBe('450.00');
    expect(file.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(file.filename).toMatch(/^clc_remittance_.*\.csv$/);
    expect(String(file.content)).toContain('"n,ote"'); // csvEscape on comma value
  });

  it('generates an XML export including optional elements', async () => {
    push([mkResult()], [parent()]);
    const file = await svc.exportRemittances({ format: 'xml' });
    const xml = String(file.content);
    expect(xml).toContain('<PerCapitaRemittances>');
    expect(xml).toContain('Local &amp; 1'); // xmlEscape
    expect(xml).toContain('<PaidDate>');
    expect(xml).toContain('<CLCAccountCode>');
    expect(xml).toContain('<Notes>');
  });

  it('omits optional XML elements when fields are absent', async () => {
    push([mkResult({ remittance: { paidDate: null, clcAccountCode: null, glAccount: null, notes: null } })], [parent()]);
    const file = await svc.exportRemittances({ format: 'xml' });
    const xml = String(file.content);
    expect(xml).not.toContain('<PaidDate>');
    expect(xml).not.toContain('<CLCAccountCode>');
    expect(xml).not.toContain('<Notes>');
  });

  it('generates an EDI X12 810 export', async () => {
    push([mkResult()], [parent()]);
    const file = await svc.exportRemittances({ format: 'edi' });
    const edi = String(file.content);
    expect(edi).toContain('ISA*');
    expect(edi).toContain('ST*810*');
    expect(edi).toContain('IEA*1*');
    expect(file.mimeType).toBe('application/edi-x12');
  });

  it('generates a StatCan export with pipe-escaped names', async () => {
    push([mkResult({ fromOrg: { name: 'Pipe|Name' } })], [parent()]);
    const file = await svc.exportRemittances({ format: 'statcan', statcanProgram: 'LAB-05302' });
    const out = String(file.content);
    expect(out).toContain('SURVEY_CODE|');
    expect(out).toContain('PipeName'); // statcanEscape removed the pipe
    expect(out).toContain('|Q1'); // March -> Q1
    expect(file.filename).toMatch(/^statcan_lab05302_/);
  });

  it('generates an Excel export via the excel generator', async () => {
    push([mkResult()], [parent()]);
    const file = await svc.exportRemittances({ format: 'excel' });
    expect(h.genExcel).toHaveBeenCalledOnce();
    expect(Buffer.isBuffer(file.content)).toBe(true);
    expect(file.mimeType).toContain('spreadsheetml');
  });

  it('throws when no remittances are found', async () => {
    push([]);
    await expect(svc.exportRemittances({ format: 'csv' })).rejects.toThrow('No remittances found');
  });

  it('throws for an unsupported format', async () => {
    push([mkResult()], [parent()]);
    await expect(svc.exportRemittances({ format: 'pdf' as never })).rejects.toThrow('Unsupported export format');
  });
});

describe('fetchRemittanceData parent handling', () => {
  it('reuses a cached parent and defaults missing parents to Unknown', async () => {
    push([mkResult(), mkResult({ remittance: { id: 'r2' } })]); // two records, same parent p1
    push([]); // parent lookup returns nothing -> Unknown, and only fetched once
    const file = await svc.exportRemittances({ format: 'csv' });
    expect(file.recordCount).toBe(2);
    expect(String(file.content)).toContain('Unknown');
  });
});

it('exposes a singleton instance', () => {
  expect(remittanceExporter).toBeInstanceOf(RemittanceExportService);
});
