import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = 'Finance and dues persistence are not available in this release.';

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

  const nothingRead = () => {
    expect(m.getBillingAccount).not.toHaveBeenCalled();
    expect(m.getLedgerSummary).not.toHaveBeenCalled();
    expect(m.getInvoices).not.toHaveBeenCalled();
    expect(m.getChargebacks).not.toHaveBeenCalled();
    expect(m.generateDuesAlignmentReport).not.toHaveBeenCalled();
  };

  it('asks the wrapper for a secretary-treasurer and declares no entitlement and no ambient tenant transaction', async () => {
    const { GET } = await loadRoute();
    const options = declaredOptions(GET);
    expect(options).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      rlsOrgContext: false,
      registry: { audience: 'officer', evidenceRequired: true },
    });
    expect(options.entitlement).toBeUndefined();
  });

  it.each([
    ['for the requested period', `?periodId=${PERIOD}`],
    ['without a period', ''],
  ])('refuses the dashboard %s with 501 NOT_IMPLEMENTED and reads nothing', async (_label, query) => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest(`http://localhost/api/finance/dashboard${query}`), ctx);

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    nothingRead();
  });

  it('refuses with 501 whether or not the organization holds the module: no entitlement check or read runs', async () => {
    const { GET } = await loadRoute();
    for (const entitled of [true, false]) {
      m.requireEntitlement.mockReset();
      if (entitled) m.requireEntitlement.mockResolvedValue(undefined);
      else m.requireEntitlement.mockRejectedValue(new Error('Entitlement missing'));
      const response = await GET(new NextRequest('http://localhost/api/finance/dashboard'), ctx);

      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    }
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    nothingRead();
  });

  it('answers a period id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/finance/dashboard?periodId=period_1'), ctx);

    expect(response.status).toBe(400);
    expect(m.getBillingAccount).not.toHaveBeenCalled();
  });

  it('never reaches the services, so a service failure cannot surface: 501 NOT_IMPLEMENTED, not 500', async () => {
    const { GET } = await loadRoute();
    m.getInvoices.mockRejectedValue(new Error('db down'));

    const response = await GET(new NextRequest('http://localhost/api/finance/dashboard'), ctx);

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    nothingRead();
  });
});
