import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ErrorCode } from '@/lib/api/errors';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  compareTiers: vi.fn(),
  projectRevenue: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics/pricing-calculator', () => ({
  compareTiers: m.compareTiers,
  projectRevenue: m.projectRevenue,
}));

async function loadRoute() {
  return import('../finance/pricing/compare/route');
}

async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
}

const url = 'http://localhost/api/finance/pricing/compare';
const post = (body: unknown) => new NextRequest(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const ctx = { organizationId: 'org_1', userId: 'u1' };

describe('finance/pricing/compare route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.compareTiers.mockReturnValue({ starter: 1000, professional: 2000 });
    m.projectRevenue.mockReturnValue([{ year: 1, revenue: 1000 }]);
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

    expect(m.compareTiers).not.toHaveBeenCalled();
    expect(m.projectRevenue).not.toHaveBeenCalled();
  });

  it('POST returns 400 for invalid JSON', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post('not-json'), ctx)).status).toBe(400);

    expect(m.compareTiers).not.toHaveBeenCalled();
    expect(m.projectRevenue).not.toHaveBeenCalled();
  });

  it('POST returns 400 for an invalid schema', async () => {
    const { POST } = await loadRoute();
    expect((await POST(post({ memberCount: 0 }), ctx)).status).toBe(400);

    expect(m.compareTiers).not.toHaveBeenCalled();
    expect(m.projectRevenue).not.toHaveBeenCalled();
  });

  it.each([
    ['without projections', { memberCount: 100, regionCount: 2 }],
    ['with projectionYears', { memberCount: 100, regionCount: 2, projectionYears: 3 }],
  ])('POST with a valid payload %s is refused as not implemented, consulting no entitlement and computing nothing', async (_name, body) => {
    const { POST } = await loadRoute();
    await expectRefused(await POST(post(body), ctx));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.compareTiers).not.toHaveBeenCalled();
    expect(m.projectRevenue).not.toHaveBeenCalled();
  });

  it('a throwing calculator is unreachable: the refusal is a 501, never a 500 from the comparison', async () => {
    const { POST } = await loadRoute();
    m.compareTiers.mockImplementationOnce(() => {
      throw new Error('calc failed');
    });
    await expectRefused(await POST(post({ memberCount: 100 }), ctx));
    expect(m.compareTiers).not.toHaveBeenCalled();
  });
});
