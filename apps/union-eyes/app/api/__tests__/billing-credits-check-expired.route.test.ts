import { describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ withApi: vi.fn(), expireTrials: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { notImplemented: (message: string) => Object.assign(new Error(message), { code: 'NOT_IMPLEMENTED' }) },
}));
vi.mock('@/services/platform-economics/subscription-lifecycle-service', () => ({ expireTrials: m.expireTrials }));

// Replaced: the previous tests asserted that the route expired trials after a payment-method check that always answered "none".
describe('billing/credits/check-expired route (not implemented)', () => {
  // DEF-0B3-TRIAL-EXPIRY-PLACEHOLDER-PAYMENT-CHECK
  it('answers 501 and cancels no trial, because there is no payment-method record to consult', async () => {
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx));
    const { POST } = await import('../billing/credits/check-expired/route');
    await expect((POST as any)({ organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    expect(m.expireTrials).not.toHaveBeenCalled();
    expect(m.withApi.mock.calls[0][0]).toMatchObject({ auth: { required: true, minRole: 'steward' }, entitlement: 'financial_intelligence_suite' });
  });
});
