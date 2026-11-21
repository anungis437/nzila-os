import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ErrorCode } from '@/lib/api/errors';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  computeQuote: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics/pricing-calculator', () => ({
  computeQuote: m.computeQuote,
}));

async function loadRoute() {
  return import('../finance/pricing/quote/route');
}

async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
}

const url = 'http://localhost/api/finance/pricing/quote';
const post = (body: unknown) => new NextRequest(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const ctx = { organizationId: 'org_1', userId: 'u1' };

describe('finance/pricing/quote route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.computeQuote.mockReturnValue({ annualRevenue: 12000, tier: 'professional' });
  });

  it('asks the wrapper for a secretary-treasurer; no entitlement or tenant transaction is declared because the base release refuses first', async () => {
    const { POST } = await loadRoute();
    expect(declaredOptions(POST)).toMatchObject({ auth: { minRole: 'secretary_treasurer' }, rlsOrgContext: false });
    expect(declaredOptions(POST)).not.toHaveProperty('entitlement');
  });

  it('POST returns 401 when organization or user missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ memberCount: 100 }), { organizationId: 'org_1' });
    expect(response.status).toBe(401);

    expect(m.computeQuote).not.toHaveBeenCalled();
  });

  it('POST returns 400 for invalid JSON', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post('not-json'), ctx)).status).toBe(400);

    expect(m.computeQuote).not.toHaveBeenCalled();
  });

  it('POST returns 400 for an invalid schema', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ memberCount: 0 }), ctx)).status).toBe(400);

    expect(m.computeQuote).not.toHaveBeenCalled();
  });

  it.each([
    ['a tier and term', { memberCount: 250, tier: 'professional', regionCount: 2, contractTermMonths: 24 }],
    ['custom discount rules', { memberCount: 250, customDiscounts: [{ type: 'custom', name: 'Pilot discount', ratePercent: 15, appliesTo: 'total' }] }],
  ])('POST with %s is refused as not implemented, consulting no entitlement and computing no quote', async (_name, body) => {
    const { POST } = await loadRoute();
    await expectRefused(await POST(post(body), ctx));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.computeQuote).not.toHaveBeenCalled();
  });

  it('a throwing pricing engine is unreachable: the refusal is a 501, never a 500 from the computation', async () => {
    const { POST } = await loadRoute();
    m.computeQuote.mockImplementationOnce(() => {
      throw new Error('pricing engine error');
    });
    await expectRefused(await POST(post({ memberCount: 200 }), ctx));
    expect(m.computeQuote).not.toHaveBeenCalled();
  });
});
