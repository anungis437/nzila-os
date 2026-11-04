import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  cancelRedemption: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/services/rewards/redemption-service', () => ({
  cancelRedemption: m.cancelRedemption,
  listUserRedemptions: vi.fn(),
}));

import { caller, resetCaller } from './support/with-api-stub';

describe('rewards/redemptions POST (cancel)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'member_1';
    caller.role = 'member';
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({}));
    m.cancelRedemption.mockResolvedValue({ redemption: { id: 'r1' }, newBalance: 10 });
  });

  const cancel = (id = '11111111-1111-4111-8111-111111111111') =>
    new NextRequest('http://localhost/api/rewards/redemptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redemptionId: id, reason: 'changed my mind' }),
    });
  const post = async (request: NextRequest) => {
    const { POST } = await import('../rewards/redemptions/route');
    return (POST as unknown as (request: NextRequest) => Promise<Response>)(request);
  };

  it('cancels only on behalf of the owning member (the caller), in the caller\u2019s organization', async () => {
    await post(cancel());

    expect(m.cancelRedemption).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'org_1', 'member_cancelled: changed my mind', { userId: 'member_1', mustOwn: true });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
  });

  it('returns a cancellation receipt without provider payload or checkout identifiers', async () => {
    m.cancelRedemption.mockResolvedValueOnce({
      redemption: { id: 'r1', status: 'cancelled', creditsSpent: 12,
        providerCheckoutId: 'private-checkout', providerOrderId: 'private-order',
        providerPayloadJson: { customer: { email: 'private@example.test' } } },
      newBalance: 42,
    });
    const response = await post(cancel());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/private-checkout|private-order|private@example/);
    expect(body.data?.redemption).toMatchObject({ id: 'r1', status: 'cancelled', creditsSpent: 12 });
    expect(body.data?.newBalance).toBe(42);
  });

  it('does not cancel when tenant binding fails', async () => {
    m.withRLSContext.mockRejectedValueOnce(new Error('tenant binding refused'));
    const response = await post(cancel());
    expect(response.status).toBe(500);
    expect(m.cancelRedemption).not.toHaveBeenCalled();
  });

  it('rejects an initiation body on the cancel path instead of discarding it', async () => {
    const request = new NextRequest('http://localhost/api/rewards/redemptions?id=r1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ programId: '11111111-1111-4111-8111-111111111111', creditsToSpend: 10 }),
    });

    const response = await post(request);

    expect(response.status).toBe(400);
    expect(m.cancelRedemption).not.toHaveBeenCalled();
  });

  it('answers 404 when the redemption is someone else\u2019s', async () => {
    m.cancelRedemption.mockRejectedValueOnce(new Error('Redemption not found'));

    const response = await post(cancel('22222222-2222-4222-8222-222222222222'));

    expect(response.status).toBe(404);
  });

  it('answers 400 for a body that is not JSON and 413 for one over the limit, cancelling nothing', async () => {
    const withBody = (body: string) => new NextRequest('http://localhost/api/rewards/redemptions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body,
    });
    expect((await post(withBody('not-json'))).status).toBe(400);
    expect((await post(withBody(JSON.stringify({ redemptionId: '11111111-1111-4111-8111-111111111111', reason: 'x'.repeat(20_000) })))).status).toBe(413);
    expect(m.cancelRedemption).not.toHaveBeenCalled();
  });

  it('answers 400 when the redemption cannot be cancelled in its current state', async () => {
    m.cancelRedemption.mockRejectedValueOnce(new Error('Cannot cancel a fulfilled redemption'));

    const response = await post(cancel());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Cannot cancel this redemption' });
  });
});
