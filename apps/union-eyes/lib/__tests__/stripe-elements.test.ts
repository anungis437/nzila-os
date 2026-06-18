import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadStripe: vi.fn(),
}));

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: mocks.loadStripe,
}));

describe('lib/stripe-elements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  });

  it('resolves to null when no publishable key is configured', async () => {
    const { getStripePromise } = await import('../stripe-elements');
    const result = await getStripePromise();
    expect(result).toBeNull();
    expect(mocks.loadStripe).not.toHaveBeenCalled();
  });

  it('memoizes a single Stripe.js load when a key is present', async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    const fakeStripe = { id: 'stripe' };
    mocks.loadStripe.mockResolvedValue(fakeStripe);

    const { getStripePromise } = await import('../stripe-elements');
    const first = getStripePromise();
    const second = getStripePromise();

    expect(first).toBe(second);
    expect(await first).toBe(fakeStripe);
    expect(mocks.loadStripe).toHaveBeenCalledTimes(1);
  });

  it('resolves to null when Stripe.js fails to load', async () => {
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    mocks.loadStripe.mockRejectedValue(new Error('network'));

    const { getStripePromise } = await import('../stripe-elements');
    expect(await getStripePromise()).toBeNull();
  });
});
