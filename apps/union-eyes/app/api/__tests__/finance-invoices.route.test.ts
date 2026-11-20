import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

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
async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
}
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

  it('asks the wrapper for the role each handler had; no entitlement or tenant transaction is declared because the base release refuses first', async () => {
    const { GET, POST } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, rlsOrgContext: false, registry: { audience: 'officer' } });
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'admin' }, rlsOrgContext: false, registry: { audience: 'admin' } });
    expect(declaredOptions(GET)).not.toHaveProperty('entitlement');
    expect(declaredOptions(POST)).not.toHaveProperty('entitlement');
  });

  it.each([
    ['no paging', ''],
    ['an oversized page and an offset', '?limit=999&offset=10'],
  ])('GET with %s is refused as not implemented, consulting no entitlement and reading no invoices', async (_name, query) => {
    const { GET } = await loadRoute();
    await expectRefused(await GET(new NextRequest(`http://localhost/api/finance/invoices${query}`), ctx));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.getInvoices).not.toHaveBeenCalled();
  });

  it('GET answers a size or offset that is not a whole number in range as a client error, never as a query fault', async () => {
    const { GET } = await loadRoute();
    for (const query of ['limit=abc', 'limit=0', 'limit=-5', 'limit=2.5', 'offset=-1', 'offset=x']) {
      const response = await GET(new NextRequest(`http://localhost/api/finance/invoices?${query}`), ctx);
      expect(response.status, query).toBe(400);
    }
    expect(m.getInvoices).not.toHaveBeenCalled();
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

  it('POST with a valid body is refused as not implemented and generates no invoice', async () => {
    const { POST } = await loadRoute();
    await expectRefused(await POST(post({ billingPeriodId: PERIOD, organizationId: 'org_other' }), ctx));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });
});
