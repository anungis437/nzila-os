import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

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

async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
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

  it('asks the wrapper for the role each handler had; the base release declares no entitlement or tenant transaction because it refuses before any read or write', async () => {
    const { GET, POST, PATCH } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, rlsOrgContext: false, registry: { audience: 'officer' } });
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'admin' }, rlsOrgContext: false, registry: { audience: 'admin' } });
    expect(declaredOptions(PATCH)).toMatchObject({ auth: { minRole: 'admin' }, rlsOrgContext: false, registry: { audience: 'admin' } });
    expect(declaredOptions(GET)).not.toHaveProperty('entitlement');
    expect(declaredOptions(POST)).not.toHaveProperty('entitlement');
    expect(declaredOptions(PATCH)).not.toHaveProperty('entitlement');
  });

  it('GET is refused as not implemented in this release, without consulting entitlement or reading the account', async () => {
    const { GET } = await loadRoute();

    await expectRefused(await GET(new NextRequest('http://localhost/api/finance/billing'), ctx));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.getBillingAccount).not.toHaveBeenCalled();
  });

  it('POST returns validation error for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(send('POST', '{bad-json'), ctx);

    expect(response.status).toBe(400);
    expect(m.createBillingAccount).not.toHaveBeenCalled();
  });

  it('POST with a valid body is refused as not implemented and creates no account', async () => {
    const { POST } = await loadRoute();

    await expectRefused(await POST(send('POST', {
      displayName: 'Union Billing',
      billingEmail: 'billing@example.com',
      netTermsDays: 30,
      organizationId: 'org_other',
      createdBy: 'someone-else',
    }), ctx));
    expect(m.createBillingAccount).not.toHaveBeenCalled();
  });

  it('PATCH with a valid body is refused as not implemented and updates no account', async () => {
    const { PATCH } = await loadRoute();

    await expect(PATCH(send('PATCH', { displayName: 'Updated Billing' }), ctx));
    expect(m.updateBillingAccount).not.toHaveBeenCalled();
  });

  it('PATCH still rejects invalid JSON before the boundary', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(send('PATCH', '{bad-json'), ctx);

    expect(response.status).toBe(400);
    expect(m.updateBillingAccount).not.toHaveBeenCalled();
  });
});
