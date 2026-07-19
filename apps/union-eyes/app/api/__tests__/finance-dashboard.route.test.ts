import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getLedgerSummary: vi.fn(),
  getBillingAccount: vi.fn(),
  getInvoices: vi.fn(),
  getChargebacks: vi.fn(),
  generateDuesAlignmentReport: vi.fn(),
}));

class MockEntitlementError extends Error {}

vi.mock('@/lib/api-auth-guard', () => ({ withMinRole: m.withMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
  EntitlementError: MockEntitlementError,
}));
vi.mock('@/services/platform-economics', () => ({
  getLedgerSummary: m.getLedgerSummary,
  getBillingAccount: m.getBillingAccount,
  getInvoices: m.getInvoices,
  getChargebacks: m.getChargebacks,
}));
vi.mock('@/services/platform-economics/dues-alignment', () => ({
  generateDuesAlignmentReport: m.generateDuesAlignmentReport,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, error?: unknown) =>
    new Response(JSON.stringify({ code, message, error }), {
      status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 500,
      headers: { 'content-type': 'application/json' },
    }),
  standardSuccessResponse: (data: unknown) =>
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
}));

async function loadRoute() {
  return import('../finance/dashboard/route');
}

describe('finance/dashboard route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation(
      (_role: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) =>
        (req: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'user_1' }) => handler(req, ctx),
    );
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getBillingAccount.mockResolvedValue({ id: 'ba_1' });
    m.getLedgerSummary.mockResolvedValue({ period: 'current', net: 1200 });
    m.getInvoices.mockResolvedValue([{ id: 'inv_1' }]);
    m.getChargebacks.mockResolvedValue([{ id: 'cb_1' }]);
    m.generateDuesAlignmentReport.mockResolvedValue({
      anomalies: [{ memberId: 'm1' }],
      orgSnapshot: { totalMembers: 100, arrearsCount: 3 },
    });
  });

  it('returns 401 when organization context is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/finance/dashboard'),
      { userId: 'user_1' },
    );

    expect(response.status).toBe(401);
  });

  it('returns 403 when entitlement check fails', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new MockEntitlementError('Entitlement missing'));

    const response = await GET(
      new NextRequest('http://localhost/api/finance/dashboard'),
      { organizationId: 'org_1', userId: 'user_1' },
    );

    expect(response.status).toBe(403);
  });

  it('returns dashboard payload with requested periodId', async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      new NextRequest('http://localhost/api/finance/dashboard?periodId=period_1'),
      { organizationId: 'org_1', userId: 'user_1' },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(m.getLedgerSummary).toHaveBeenCalledWith({ organizationId: 'org_1', billingPeriodId: 'period_1' });
    expect(payload.data.duesAlignment.anomalyCount).toBe(1);
  });

  it('returns dashboard payload without periodId', async () => {
    const { GET } = await loadRoute();

    const response = await GET(
      new NextRequest('http://localhost/api/finance/dashboard'),
      { organizationId: 'org_1', userId: 'user_1' },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.billingAccount.id).toBe('ba_1');
    expect(payload.data.recentChargebacks).toHaveLength(1);
  });

  it('returns 500 for unexpected service errors', async () => {
    const { GET } = await loadRoute();
    m.getInvoices.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(
      new NextRequest('http://localhost/api/finance/dashboard'),
      { organizationId: 'org_1', userId: 'user_1' },
    );

    expect(response.status).toBe(500);
  });
});
