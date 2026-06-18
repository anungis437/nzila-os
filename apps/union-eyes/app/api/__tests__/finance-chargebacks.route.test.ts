import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getChargebacks: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withMinRole: m.withMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ getChargebacks: m.getChargebacks }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), { status: code === 'INTERNAL_ERROR' ? 500 : code === 'AUTH_REQUIRED' ? 401 : 403 }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/chargebacks/route');
}

describe('finance/chargebacks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation((_role: string, handler: (request: Request, context: any) => Promise<Response>) =>
      (request: Request, context: any = {}) => handler(request, context));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getChargebacks.mockResolvedValue([{ id: 'cb_1', amount: 123 }]);
  });

  it('returns auth required when organizationId is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/finance/chargebacks'));

    expect(response.status).toBe(401);
  });

  it('returns chargebacks for the organization', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new Request('http://localhost/api/finance/chargebacks?localId=loc_1&periodId=per_1'),
      { organizationId: 'org_1', userId: 'u1' },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'financial_intelligence_suite', 'u1');
    expect(m.getChargebacks).toHaveBeenCalledWith({ organizationId: 'org_1', localId: 'loc_1', billingPeriodId: 'per_1' });
    expect(json).toEqual([{ id: 'cb_1', amount: 123 }]);
  });
});