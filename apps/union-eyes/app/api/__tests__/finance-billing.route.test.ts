import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  createBillingAccount: vi.fn(),
  getBillingAccount: vi.fn(),
  updateBillingAccount: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({
  createBillingAccount: m.createBillingAccount,
  getBillingAccount: m.getBillingAccount,
  updateBillingAccount: m.updateBillingAccount,
}));

async function loadRoute() {
  return import('../finance/billing/route');
}

const ctx = { userId: 'u1', organizationId: 'org_1' };
const send = (method: string, body: unknown) => new NextRequest('http://localhost/api/finance/billing', {
  method,
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('finance/billing route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getBillingAccount.mockResolvedValue({ id: 'acct_1', displayName: 'Union Billing' });
    m.createBillingAccount.mockResolvedValue({ id: 'acct_2', displayName: 'New Billing' });
    m.updateBillingAccount.mockResolvedValue({ id: 'acct_1', displayName: 'Updated Billing' });
  });

  it('asks the wrapper for the role each handler had, the entitlement, and the organization\'s own tenant transaction', async () => {
    const { GET, POST, PATCH } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'officer' } });
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'admin' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'admin' } });
    expect(declaredOptions(PATCH)).toMatchObject({ auth: { minRole: 'admin' }, entitlement: 'financial_intelligence_suite', rlsOrgContext: true, registry: { audience: 'admin' } });
  });

  it('GET returns forbidden when entitlement check fails, without reading the account', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));

    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), ctx);

    expect(response.status).toBe(403);
    expect(m.getBillingAccount).not.toHaveBeenCalled();
  });

  it('GET reads the caller organization\'s account', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), ctx);

    expect(response.status).toBe(200);
    expect(m.getBillingAccount).toHaveBeenCalledWith('org_1');
  });

  it('GET returns not found when no billing account exists', async () => {
    const { GET } = await loadRoute();
    m.getBillingAccount.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), ctx);

    expect(response.status).toBe(404);
  });

  it('GET reports a read that failed as a 500, never as a missing account', async () => {
    const { GET } = await loadRoute();
    m.getBillingAccount.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), ctx);

    expect(response.status).toBe(500);
  });

  it('POST returns validation error for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(send('POST', '{bad-json'), ctx);

    expect(response.status).toBe(400);
    expect(m.createBillingAccount).not.toHaveBeenCalled();
  });

  it('POST creates the account for the caller organization and user, whatever the body says', async () => {
    const { POST } = await loadRoute();
    const response = await POST(send('POST', {
      displayName: 'Union Billing',
      billingEmail: 'billing@example.com',
      netTermsDays: 30,
      organizationId: 'org_other',
      createdBy: 'someone-else',
    }), ctx);

    expect(response.status).toBe(200);
    expect(m.createBillingAccount).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', createdBy: 'u1', displayName: 'Union Billing' }));
  });

  it('PATCH returns not found when no billing account exists to update', async () => {
    const { PATCH } = await loadRoute();
    m.updateBillingAccount.mockResolvedValueOnce(null);

    const response = await PATCH(send('PATCH', { displayName: 'Updated' }), ctx);

    expect(response.status).toBe(404);
  });

  it('PATCH updates the caller organization\'s account as the caller', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(send('PATCH', { displayName: 'Updated Billing' }), ctx);

    expect(response.status).toBe(200);
    expect(m.updateBillingAccount).toHaveBeenCalledWith('org_1', { displayName: 'Updated Billing' }, 'u1');
  });
});
