import { beforeEach, describe, expect, it, vi } from 'vitest';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getChargebacks: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ getChargebacks: m.getChargebacks }));

async function loadRoute() {
  return import('../finance/chargebacks/route');
}

const LOCAL = '550e8400-e29b-41d4-a716-446655440010';
const PERIOD = '550e8400-e29b-41d4-a716-446655440011';

describe('finance/chargebacks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getChargebacks.mockResolvedValue([{ id: 'cb_1', amount: 123 }]);
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

  it('is refused without the entitlement, and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('no module'));
    const response = await GET(new Request('http://localhost/api/finance/chargebacks'), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(403);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'financial_intelligence_suite', 'u1');
    expect(m.getChargebacks).not.toHaveBeenCalled();
  });

  it('returns the chargebacks of the caller organization, for the local and period asked', async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      new Request(`http://localhost/api/finance/chargebacks?localId=${LOCAL}&periodId=${PERIOD}`),
      { organizationId: 'org_1', userId: 'u1' },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(m.getChargebacks).toHaveBeenCalledWith({ organizationId: 'org_1', localId: LOCAL, billingPeriodId: PERIOD });
    expect(json.data).toEqual([{ id: 'cb_1', amount: 123 }]);
  });

  it('answers an id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();
    for (const query of ['localId=loc_1', 'periodId=per_1', 'periodId=']) {
      const response = await GET(new Request(`http://localhost/api/finance/chargebacks?${query}`), { organizationId: 'org_1', userId: 'u1' });
      expect(response.status, query).toBe(400);
    }
    expect(m.getChargebacks).not.toHaveBeenCalled();
  });

  it('reports a read that failed as a 500, never as an empty list', async () => {
    const { GET } = await loadRoute();
    m.getChargebacks.mockRejectedValueOnce(new Error('db down'));
    const response = await GET(new Request('http://localhost/api/finance/chargebacks'), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(500);
  });
});
