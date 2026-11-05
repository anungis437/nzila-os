import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getInvoices: vi.fn(),
  generateInvoice: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({
  getInvoices: m.getInvoices,
  generateInvoice: m.generateInvoice,
}));

async function loadRoute() {
  return import('../finance/invoices/route');
}

const PERIOD = '12345678-1234-1234-1234-123456789012';
const ctx = { organizationId: 'org_1', userId: 'u1' };
const post = (body: unknown) => new NextRequest('http://localhost/api/finance/invoices', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('finance/invoices route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getInvoices.mockResolvedValue([{ id: 'inv_1' }]);
    m.generateInvoice.mockResolvedValue({ id: 'inv_new' });
  });

  it('asks the wrapper for the role each handler had, the entitlement, and the organization\'s own tenant transaction', async () => {
    const { GET, POST } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'officer' } });
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'admin' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'admin' } });
  });

  it('GET returns 403 when entitlement check fails, and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices'), ctx);
    expect(response.status).toBe(403);
    expect(m.getInvoices).not.toHaveBeenCalled();
  });

  it('GET pages through the caller organization\'s invoices, with the size capped', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices?limit=999&offset=10'), ctx);
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(m.getInvoices).toHaveBeenCalledWith('org_1', 200, 10);
    expect(json.meta).toEqual({ total: 1, limit: 200, offset: 10 });
  });

  it('GET defaults to the first page of 50', async () => {
    const { GET } = await loadRoute();
    await GET(new NextRequest('http://localhost/api/finance/invoices'), ctx);
    expect(m.getInvoices).toHaveBeenCalledWith('org_1', 50, 0);
  });

  it('GET answers a size or offset that is not a whole number in range as a client error, never as a query fault', async () => {
    const { GET } = await loadRoute();
    for (const query of ['limit=abc', 'limit=0', 'limit=-5', 'limit=2.5', 'offset=-1', 'offset=x']) {
      const response = await GET(new NextRequest(`http://localhost/api/finance/invoices?${query}`), ctx);
      expect(response.status, query).toBe(400);
    }
    expect(m.getInvoices).not.toHaveBeenCalled();
  });

  it('GET returns 500 when invoice fetch throws', async () => {
    const { GET } = await loadRoute();
    m.getInvoices.mockRejectedValueOnce(new Error('db error'));
    const response = await GET(new NextRequest('http://localhost/api/finance/invoices'), ctx);
    expect(response.status).toBe(500);
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post('not-json'), ctx);
    expect(response.status).toBe(400);
  });

  it('POST returns validation error for invalid body schema', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ billingPeriodId: 'not-a-uuid' }), ctx);
    expect(response.status).toBe(400);
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('POST generates the invoice for the caller organization and user, whatever the body says', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ billingPeriodId: PERIOD, organizationId: 'org_other' }), ctx);
    expect(response.status).toBe(200);
    expect(m.generateInvoice).toHaveBeenCalledWith({ organizationId: 'org_1', billingPeriodId: PERIOD, createdBy: 'u1' });
  });
});
