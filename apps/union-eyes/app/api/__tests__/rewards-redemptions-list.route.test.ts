import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  list: vi.fn(),
  tx: { marker: 'tx' },
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({ marker: 'tx' })),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/services/rewards/redemption-service', () => ({ cancelRedemption: vi.fn(), listUserRedemptions: m.list }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

import { caller, declared, resetCaller } from './support/with-api-stub';

const get = async (query = '') => {
  const { GET } = await import('../rewards/redemptions/route');
  return (GET as unknown as (request: NextRequest) => Promise<Response>)(new NextRequest(`http://localhost/api/rewards/redemptions${query}`));
};

describe('rewards/redemptions GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    m.list.mockResolvedValue({
      redemptions: [{ id: 'r1', status: 'fulfilled', creditsSpent: 10, providerOrderId: 'order-1', providerCheckoutId: 'checkout-1', providerPayloadJson: { customer: { email: 'x@example.test' } } }],
      total: 1,
    });
  });

  it('is a member read on the withApi framework, and leaves the tenant transaction to the handler', async () => {
    await import('../rewards/redemptions/route');
    expect(declared.map((entry) => entry.auth?.minRole)).toEqual(['member', 'member']);
    expect(declared.every((entry) => entry.auth?.required === true)).toBe(true);
    expect(declared.every((entry) => entry.rlsOrgContext === undefined)).toBe(true);
  });

  // DEF-0B11-PRP-REDEMPTIONS-GET-RETURNS-WHOLE-ROWS-INCLUDING-THE-PROVIDER-PAYLOAD
  it('returns the member\'s redemptions without the provider payload or checkout identifier', async () => {
    const body = await (await get()).json();
    expect(body.data?.redemptions ?? body.redemptions).toEqual([{ id: 'r1', status: 'fulfilled', creditsSpent: 10, providerOrderId: 'order-1' }]);
  });

  // DEF-0B11-PRP-REDEMPTIONS-GET-IGNORES-THE-STATUS-FILTER-AND-VALIDATES-AGAINST-AN-INCOMPLETE-LIST
  it('passes a valid status filter to the query and accepts the statuses a redemption starts in', async () => {
    caller.userId = 'member_1';
    await get('?status=pending_payment');
    expect(m.list).toHaveBeenCalledWith('org_1', 'member_1', 20, 0, 'pending_payment', m.tx);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
  });

  it('fails closed when tenant binding refuses the read', async () => {
    m.withRLSContext.mockRejectedValueOnce(new Error('tenant binding refused'));
    const response = await get();
    expect(response.status).toBe(500);
    expect(m.list).not.toHaveBeenCalled();
  });

  it('refuses a status no redemption holds with 400, without querying', async () => {
    caller.userId = 'member_1';
    const response = await get('?status=pending');
    expect(response.status).toBe(400);
    expect(m.list).not.toHaveBeenCalled();
  });

  it('turns a non-numeric or negative page request into bounded defaults instead of NaN', async () => {
    await get('?limit=abc&offset=-5');
    expect(m.list).toHaveBeenCalledWith('org_1', 'u1', 20, 0, undefined, m.tx);
    await get('?limit=9999&offset=3');
    expect(m.list).toHaveBeenLastCalledWith('org_1', 'u1', 100, 3, undefined, m.tx);
  });

  it('answers the wrapper\'s refusal, not a read, when the caller has no organization', async () => {
    caller.organizationId = null;
    const response = await get();
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(m.list).not.toHaveBeenCalled();
  });
});
