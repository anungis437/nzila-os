import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  exportMasterInvoice: vi.fn(),
  exportAllocationStatement: vi.fn(),
  exportChargebackReport: vi.fn(),
  exportGlJournal: vi.fn(),
  glJournalToCsv: vi.fn(),
  generateEvidencePack: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withMinRole: vi.fn(
    (_role: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) =>
      (req: NextRequest, ctx: any) => handler(req, ctx),
  ),
}));
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

  it('returns auth required without organization context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/exports?type=master_invoice'), {
      organizationId: '', userId: 'u1',
    });
    expect(response.status).toBe(401);
  });

  it('returns validation error when type is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/exports'), {
      organizationId: 'org_1', userId: 'u1',
    });
    expect(response.status).toBe(400);
  });

  it('exports master invoice when invoiceId is provided', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/exports?type=master_invoice&invoiceId=inv_1'), {
      organizationId: 'org_1', userId: 'u1',
    });
    expect(response.status).toBe(200);
    expect(m.exportMasterInvoice).toHaveBeenCalledWith('org_1', 'inv_1');
  });

  it('exports GL journal as CSV when format=csv', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/exports?type=gl_journal&periodId=per_1&format=csv'), {
      organizationId: 'org_1', userId: 'u1',
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(body).toContain('id');
  });

  it('exports evidence pack when periodId is provided', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/exports?type=evidence_pack&periodId=per_2'), {
      organizationId: 'org_1', userId: 'u1',
    });
    expect(response.status).toBe(200);
    expect(m.generateEvidencePack).toHaveBeenCalledWith('org_1', 'per_2');
  });

  it('returns validation error for unknown export type', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/exports?type=unknown'), {
      organizationId: 'org_1', userId: 'u1',
    });
    expect(response.status).toBe(400);
  });
});
