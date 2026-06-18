import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  createBillingAccount: vi.fn(),
  getBillingAccount: vi.fn(),
  updateBillingAccount: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withMinRole: vi.fn(
    (_role: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) =>
      (req: NextRequest, ctx: any) => handler(req, ctx),
  ),
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));

vi.mock('@/services/platform-economics', () => ({
  createBillingAccount: m.createBillingAccount,
  getBillingAccount: m.getBillingAccount,
  updateBillingAccount: m.updateBillingAccount,
}));

async function loadRoute() {
  return import('../finance/billing/route');
}

describe('finance/billing route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getBillingAccount.mockResolvedValue({ id: 'acct_1', displayName: 'Union Billing' });
    m.createBillingAccount.mockResolvedValue({ id: 'acct_2', displayName: 'New Billing' });
    m.updateBillingAccount.mockResolvedValue({ id: 'acct_1', displayName: 'Updated Billing' });
  });

  it('GET returns auth required without organization context', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), { userId: 'u1', organizationId: '' });

    expect(response.status).toBe(401);
  });

  it('GET returns forbidden when entitlement check fails', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));

    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(403);
  });

  it('GET returns not found when no billing account exists', async () => {
    const { GET } = await loadRoute();
    m.getBillingAccount.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/finance/billing'), { userId: 'u1', organizationId: 'org_1' });

    expect(response.status).toBe(404);
  });

  it('POST returns validation error for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/billing', {
        method: 'POST',
        body: '{bad-json',
        headers: { 'content-type': 'application/json' },
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(400);
  });

  it('POST creates billing account when payload is valid', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/billing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          displayName: 'Union Billing',
          billingEmail: 'billing@example.com',
          netTermsDays: 30,
        }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(200);
    expect(m.createBillingAccount).toHaveBeenCalled();
  });

  it('PATCH returns not found when no billing account exists to update', async () => {
    const { PATCH } = await loadRoute();
    m.updateBillingAccount.mockResolvedValueOnce(null);

    const response = await PATCH(
      new NextRequest('http://localhost/api/finance/billing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Updated' }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(404);
  });

  it('PATCH updates billing account when payload is valid', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(
      new NextRequest('http://localhost/api/finance/billing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName: 'Updated Billing' }),
      }),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(200);
    expect(m.updateBillingAccount).toHaveBeenCalledWith('org_1', { displayName: 'Updated Billing' }, 'u1');
  });
});
