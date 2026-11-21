import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getChargebacks: vi.fn(),
}));

// The shared double reports every code it does not know as 500, so the handler is also exposed raw (`.handler`) to assert the thrown 501 refusal itself.
vi.mock('@/lib/api/framework', async () => {
  const double = await import('./with-api-double');
  return {
    ...double.frameworkDouble,
    withApi: (options: any, handler: any) => Object.assign(double.withApiDouble(options, handler), { handler }),
  };
});
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ getChargebacks: m.getChargebacks }));

async function loadRoute() {
  return import('../finance/chargebacks/route');
}

const LOCAL = '550e8400-e29b-41d4-a716-446655440010';
const PERIOD = '550e8400-e29b-41d4-a716-446655440011';
const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

describe('finance/chargebacks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getChargebacks.mockResolvedValue([{ id: 'cb_1', amount: 123 }]);
  });

  it('asks the wrapper for a secretary-treasurer and declares its registry entry', async () => {
    const { GET } = await loadRoute();
    // The route no longer declares an entitlement or a tenant transaction: the base release refuses before either would matter.
    expect(declaredOptions(GET)).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      rlsOrgContext: false,
      registry: { audience: 'officer', evidenceRequired: true },
    });
  });

  it.each([
    ['no filter', { query: {} }],
    ['a local and a period', { query: { localId: LOCAL, periodId: PERIOD } }],
  ])('is refused with 501 and reads no chargebacks, for %s', async (_label, extra) => {
    const { GET } = await loadRoute();

    await expect(
      (GET as any).handler({ organizationId: 'org_1', userId: 'u1', ...extra }),
    ).rejects.toMatchObject(REFUSAL);
    expect(m.getChargebacks).not.toHaveBeenCalled();
  });

  it('refuses with 501, not 500, even when the underlying read would fail', async () => {
    const { GET } = await loadRoute();
    m.getChargebacks.mockRejectedValueOnce(new Error('db down'));

    await expect(
      (GET as any).handler({ organizationId: 'org_1', userId: 'u1', query: {} }),
    ).rejects.toMatchObject(REFUSAL);
    expect(m.getChargebacks).not.toHaveBeenCalled();
  });

  it('answers an id that is not a uuid as a client error, never as a database fault', async () => {
    const { GET } = await loadRoute();
    for (const query of ['localId=loc_1', 'periodId=per_1', 'periodId=']) {
      const response = await GET(new Request(`http://localhost/api/finance/chargebacks?${query}`), { organizationId: 'org_1', userId: 'u1' });
      expect(response.status, query).toBe(400);
    }
    expect(m.getChargebacks).not.toHaveBeenCalled();
  });
});
