import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getLedgerSummary: vi.fn(),
  getBillingAccount: vi.fn(),
  getInvoices: vi.fn(),
  getChargebacks: vi.fn(),
  generateDuesAlignmentReport: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({
  getLedgerSummary: m.getLedgerSummary,
  getBillingAccount: m.getBillingAccount,
  getInvoices: m.getInvoices,
  getChargebacks: m.getChargebacks,
}));
vi.mock('@/services/platform-economics/dues-alignment', () => ({
  generateDuesAlignmentReport: m.generateDuesAlignmentReport,
}));

async function loadRoute() {
  return import('../finance/dashboard/route');
}

const PERIOD = '550e8400-e29b-41d4-a716-446655440020';
const ctx = { organizationId: 'org_1', userId: 'user_1' };

describe('finance/dashboard route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('asks the wrapper for a secretary-treasurer, the entitlement and the organization\'s own tenant transaction', async () => {
    const { GET } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      entitlement: 'financial_intelligence_suite',
      rlsOrgContext: true,
      registry: { audience: 'officer', evidenceRequired: true },
    });
  });

  it('returns 403 when the entitlement check fails, and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('Entitlement missing'));

    const response = await GET(new NextRequest('http://localhost/api/finance/dashboard'), ctx);

    expect(response.status).toBe(403);
    expect(m.getBillingAccount).not.toHaveBeenCalled();
  });

  it('returns the dashboard of the caller organization for the requested period', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest(`http://localhost/api/finance/dashboard?periodId=${PERIOD}`), ctx);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(m.getBillingAccount).toHaveBeenCalledWith('org_1');
    expect(m.getLedgerSummary).toHaveBeenCalledWith({ organizationId: 'org_1', billingPeriodId: PERIOD });
    expect(m.generateDuesAlignmentReport).toHaveBeenCalledWith('org_1', PERIOD);
    expect(payload.data.duesAlignment.anomalyCount).toBe(1);
  });

  it('returns the dashboard without a period', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/finance/dashboard'), ctx);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(m.getLedgerSummary).not.toHaveBeenCalled();
    expect(m.generateDuesAlignmentReport).toHaveBeenCalledWith('org_1', 'current');
    expect(payload.data.billingAccount.id).toBe('ba_1');
    expect(payload.data.recentChargebacks).toHaveLength(1);
  });

  it('answers a period id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/finance/dashboard?periodId=period_1'), ctx);

    expect(response.status).toBe(400);
    expect(m.getBillingAccount).not.toHaveBeenCalled();
  });

  it('returns 500 for unexpected service errors', async () => {
    const { GET } = await loadRoute();
    m.getInvoices.mockRejectedValueOnce(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/finance/dashboard'), ctx);

    expect(response.status).toBe(500);
  });
});
