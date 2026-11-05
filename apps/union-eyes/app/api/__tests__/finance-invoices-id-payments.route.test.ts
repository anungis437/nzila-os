import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getInvoiceWithLineItems: vi.fn(),
  getPayments: vi.fn(),
  recordPayment: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({
  getInvoiceWithLineItems: m.getInvoiceWithLineItems,
  getPayments: m.getPayments,
  recordPayment: m.recordPayment,
}));

async function loadRoute() {
  return import('../finance/invoices/[id]/payments/route');
}

const INVOICE = '550e8400-e29b-41d4-a716-446655440050';
const url = `http://localhost/api/finance/invoices/${INVOICE}/payments`;
const as = (id = INVOICE) => ({ organizationId: 'org_1', userId: 'u1', params: { id } });
const post = (body: unknown) => new NextRequest(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('finance/invoices/[id]/payments route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getInvoiceWithLineItems.mockResolvedValue({ id: INVOICE, lineItems: [] });
    m.getPayments.mockResolvedValue([{ id: 'pay_1' }]);
    m.recordPayment.mockResolvedValue({ id: 'pay_new' });
  });

  it('asks the wrapper for the role each handler had, the entitlement, and the organization\'s own tenant transaction', async () => {
    const { GET, POST } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'officer' } });
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'admin' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'admin' } });
  });

  it('GET is refused without the entitlement, and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('no module'));
    const response = await GET(new NextRequest(url), as());
    expect(response.status).toBe(403);
    expect(m.getPayments).not.toHaveBeenCalled();
  });

  it('GET returns the payments of the invoice for the caller organization', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest(url), as());
    expect(response.status).toBe(200);
    expect(m.getPayments).toHaveBeenCalledWith('org_1', INVOICE);
  });

  it('GET answers an invoice id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();
    expect((await GET(new NextRequest(url), as('inv_1'))).status).toBe(400);
    expect(m.getPayments).not.toHaveBeenCalled();
  });

  it('GET returns 500 when payments fetch fails', async () => {
    const { GET } = await loadRoute();
    m.getPayments.mockRejectedValueOnce(new Error('db error'));
    const response = await GET(new NextRequest(url), as());
    expect(response.status).toBe(500);
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post('invalid-json'), as());
    expect(response.status).toBe(400);
  });

  it('POST returns validation error for an amount that is not CAD cents or is not positive', async () => {
    const { POST } = await loadRoute();
    for (const amount of ['100', '0.00', '-5.00', '1e3', 'abc']) {
      const response = await POST(post({ amount, method: 'eft' }), as());
      expect(response.status, amount).toBe(400);
    }
    expect(m.recordPayment).not.toHaveBeenCalled();
  });

  it('POST answers an invoice id that is not a uuid as a client error', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ amount: '10.00', method: 'eft' }), as('inv_1'))).status).toBe(400);
    expect(m.recordPayment).not.toHaveBeenCalled();
  });

  it('POST answers an invoice the organization does not have as not found, and records nothing', async () => {
    const { POST } = await loadRoute();
    m.getInvoiceWithLineItems.mockResolvedValueOnce(null);
    const response = await POST(post({ amount: '10.00', method: 'eft' }), as());
    expect(response.status).toBe(404);
    expect(m.getInvoiceWithLineItems).toHaveBeenCalledWith(INVOICE, 'org_1');
    expect(m.recordPayment).not.toHaveBeenCalled();
  });

  it('POST records the payment for the caller organization and user, whatever the body says', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ amount: '100.50', method: 'eft', externalReference: 'bank-ref-1', organizationId: 'org_other', createdBy: 'someone' }), as());
    expect(response.status).toBe(200);
    expect(m.recordPayment).toHaveBeenCalledWith({
      organizationId: 'org_1',
      invoiceId: INVOICE,
      amount: '100.50',
      method: 'eft',
      externalReference: 'bank-ref-1',
      createdBy: 'u1',
    });
  });

  it('POST reports a payment that failed as a 500, never as recorded', async () => {
    const { POST } = await loadRoute();
    m.recordPayment.mockRejectedValueOnce(new Error('db error'));
    const response = await POST(post({ amount: '10.00', method: 'eft' }), as());
    expect(response.status).toBe(500);
  });
});
