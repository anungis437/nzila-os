import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

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
async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
}
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

  it('asks the wrapper for the role each handler had; no entitlement or tenant transaction is declared because the base release refuses first', async () => {
    const { GET, POST } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, rlsOrgContext: false, registry: { audience: 'officer' } });
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'admin' }, rlsOrgContext: false, registry: { audience: 'admin' } });
    expect(declaredOptions(GET)).not.toHaveProperty('entitlement');
    expect(declaredOptions(POST)).not.toHaveProperty('entitlement');
  });

  it('GET for a valid invoice id is refused as not implemented, consulting no entitlement and reading no payments', async () => {
    const { GET } = await loadRoute();
    await expectRefused(await GET(new NextRequest(url), as()));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.getPayments).not.toHaveBeenCalled();
  });

  it('GET answers an invoice id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();
    expect((await GET(new NextRequest(url), as('inv_1'))).status).toBe(400);
    expect(m.getPayments).not.toHaveBeenCalled();
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

  it('POST with a valid body is refused as not implemented: no invoice is looked up and no payment is recorded', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ amount: '100.50', method: 'eft', externalReference: 'bank-ref-1', organizationId: 'org_other', createdBy: 'someone' }), as());
    await expectRefused(response);
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.getInvoiceWithLineItems).not.toHaveBeenCalled();
    expect(m.recordPayment).not.toHaveBeenCalled();
  });
});
