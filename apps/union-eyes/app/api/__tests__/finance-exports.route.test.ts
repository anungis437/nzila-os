import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

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

  it('asks the wrapper for a secretary-treasurer, the entitlement and the organization\'s own tenant transaction', async () => {
    const { GET } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      entitlement: 'financial_intelligence_suite',
      rlsOrgContext: true,
      registry: { audience: 'officer', evidenceRequired: true },
    });
  });

  it('is refused without the entitlement, and exports nothing', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('no module'));
    const response = await GET(get(`?type=master_invoice&invoiceId=${INVOICE}`), ctx);

    expect(response.status).toBe(403);
    expect(m.exportMasterInvoice).not.toHaveBeenCalled();
  });

  it('returns validation error when type is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get(''), ctx);
    expect(response.status).toBe(400);
  });

  it('exports the caller organization\'s master invoice', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get(`?type=master_invoice&invoiceId=${INVOICE}`), ctx);
    expect(response.status).toBe(200);
    expect(m.exportMasterInvoice).toHaveBeenCalledWith('org_1', INVOICE);
  });

  it('exports an allocation statement and a chargeback report for the caller organization', async () => {
    const { GET } = await loadRoute();
    expect((await GET(get(`?type=allocation_statement&allocationRunId=${RUN}`), ctx)).status).toBe(200);
    expect(m.exportAllocationStatement).toHaveBeenCalledWith('org_1', RUN);
    expect((await GET(get(`?type=chargeback_report&localId=${LOCAL}&periodId=${PERIOD}`), ctx)).status).toBe(200);
    expect(m.exportChargebackReport).toHaveBeenCalledWith('org_1', LOCAL, PERIOD);
  });

  it('exports GL journal as CSV when format=csv', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get(`?type=gl_journal&periodId=${PERIOD}&format=csv`), ctx);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(body).toContain('id');
  });

  it('exports evidence pack when periodId is provided', async () => {
    const { GET } = await loadRoute();
    const response = await GET(get(`?type=evidence_pack&periodId=${PERIOD}`), ctx);
    expect(response.status).toBe(200);
    expect(m.generateEvidencePack).toHaveBeenCalledWith('org_1', PERIOD);
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

  it('reports an export that failed as a 500, never as an empty export', async () => {
    const { GET } = await loadRoute();
    m.exportGlJournal.mockRejectedValueOnce(new Error('db down'));
    const response = await GET(get(`?type=gl_journal&periodId=${PERIOD}`), ctx);
    expect(response.status).toBe(500);
  });
});
