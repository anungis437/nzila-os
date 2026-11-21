import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  exportMasterInvoice: vi.fn(),
  exportAllocationStatement: vi.fn(),
  exportChargebackReport: vi.fn(),
  exportGlJournal: vi.fn(),
  glJournalToCsv: vi.fn(),
  generateEvidencePack: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({
  exportMasterInvoice: m.exportMasterInvoice,
  exportAllocationStatement: m.exportAllocationStatement,
  exportChargebackReport: m.exportChargebackReport,
  exportGlJournal: m.exportGlJournal,
  glJournalToCsv: m.glJournalToCsv,
  generateEvidencePack: m.generateEvidencePack,
}));

async function loadRoute() {
  return import('../finance/exports/route');
}

const INVOICE = '550e8400-e29b-41d4-a716-446655440030';
const PERIOD = '550e8400-e29b-41d4-a716-446655440031';
const RUN = '550e8400-e29b-41d4-a716-446655440032';
const LOCAL = '550e8400-e29b-41d4-a716-446655440033';
async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
}
const ctx = { organizationId: 'org_1', userId: 'u1' };
const get = (query: string) => new NextRequest(`http://localhost/api/finance/exports${query}`);

describe('finance/exports route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.exportMasterInvoice.mockResolvedValue({ kind: 'master' });
    m.exportAllocationStatement.mockResolvedValue({ kind: 'allocation' });
    m.exportChargebackReport.mockResolvedValue({ kind: 'chargeback' });
    m.exportGlJournal.mockResolvedValue({ lines: [{ id: 1 }] });
    m.glJournalToCsv.mockReturnValue('id\n1');
    m.generateEvidencePack.mockResolvedValue({ kind: 'evidence' });
  });

  it('asks the wrapper for a secretary-treasurer; the base release declares no entitlement or tenant transaction because it refuses before any read', async () => {
    const { GET } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      rlsOrgContext: false,
      registry: { audience: 'officer', evidenceRequired: true },
    });
    expect(declaredOptions(GET)).not.toHaveProperty('entitlement');
  });

  it('returns validation error when type is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get(''), ctx);
    expect(response.status).toBe(400);
  });

  it.each([
    ['master_invoice', () => `?type=master_invoice&invoiceId=${INVOICE}`],
    ['allocation_statement', () => `?type=allocation_statement&allocationRunId=${RUN}`],
    ['chargeback_report', () => `?type=chargeback_report&localId=${LOCAL}&periodId=${PERIOD}`],
    ['gl_journal json', () => `?type=gl_journal&periodId=${PERIOD}`],
    ['gl_journal csv', () => `?type=gl_journal&periodId=${PERIOD}&format=csv`],
    ['evidence_pack', () => `?type=evidence_pack&periodId=${PERIOD}`],
  ])('refuses a valid %s export as not implemented, reading and exporting nothing', async (_name, query) => {
    const { GET } = await loadRoute();
    const response = await GET(get(query()), ctx);

    await expectRefused(response);
    expect(response.headers.get('content-type')).not.toContain('text/csv');
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    for (const exporter of [m.exportMasterInvoice, m.exportAllocationStatement, m.exportChargebackReport, m.exportGlJournal, m.glJournalToCsv, m.generateEvidencePack]) {
      expect(exporter).not.toHaveBeenCalled();
    }
  });

  it('names what an export still needs', async () => {
    const { GET } = await loadRoute();
    for (const query of ['?type=master_invoice', '?type=allocation_statement', '?type=chargeback_report', '?type=gl_journal', '?type=evidence_pack', '?type=unknown']) {
      expect((await GET(get(query), ctx)).status, query).toBe(400);
    }
    expect(m.exportMasterInvoice).not.toHaveBeenCalled();
  });

  it('answers an id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();
    for (const query of ['?type=master_invoice&invoiceId=inv_1', '?type=gl_journal&periodId=per_1', '?type=allocation_statement&allocationRunId=run_1', '?type=chargeback_report&localId=loc_1']) {
      expect((await GET(get(query), ctx)).status, query).toBe(400);
    }
    expect(m.exportGlJournal).not.toHaveBeenCalled();
    expect(m.exportMasterInvoice).not.toHaveBeenCalled();
  });

  it('a failing exporter is unreachable: the refusal is a 501, never a 500 from the export', async () => {
    const { GET } = await loadRoute();
    m.exportGlJournal.mockRejectedValueOnce(new Error('db down'));
    await expectRefused(await GET(get(`?type=gl_journal&periodId=${PERIOD}`), ctx));
    expect(m.exportGlJournal).not.toHaveBeenCalled();
  });
});
