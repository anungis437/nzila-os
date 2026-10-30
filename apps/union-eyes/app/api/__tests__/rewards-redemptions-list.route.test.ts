import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@/lib/services/rewards/redemption-service', () => ({ cancelRedemption: vi.fn(), listUserRedemptions: m.list }));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown = { userId: 'u1', organizationId: 'org_1' }) => handler(req, ctx),
}));

const get = async (query = '') => {
  const { GET } = await import('../rewards/redemptions/route');
  return GET(new NextRequest(`http://localhost/api/rewards/redemptions${query}`));
};

describe('rewards/redemptions GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.list.mockResolvedValue({
      redemptions: [{ id: 'r1', status: 'fulfilled', creditsSpent: 10, providerOrderId: 'order-1', providerCheckoutId: 'checkout-1', providerPayloadJson: { customer: { email: 'x@example.test' } } }],
      total: 1,
    });
  });

  // DEF-0B11-PRP-REDEMPTIONS-GET-RETURNS-WHOLE-ROWS-INCLUDING-THE-PROVIDER-PAYLOAD
  it('returns the member\'s redemptions without the provider payload or checkout identifier', async () => {
    const body = await (await get()).json();
    expect(body.data?.redemptions ?? body.redemptions).toEqual([{ id: 'r1', status: 'fulfilled', creditsSpent: 10, providerOrderId: 'order-1' }]);
  });

  it('turns a non-numeric or negative page request into bounded defaults instead of NaN', async () => {
    await get('?limit=abc&offset=-5');
    expect(m.list).toHaveBeenCalledWith('org_1', 'u1', 20, 0);
    await get('?limit=9999&offset=3');
    expect(m.list).toHaveBeenLastCalledWith('org_1', 'u1', 100, 3);
  });
});
