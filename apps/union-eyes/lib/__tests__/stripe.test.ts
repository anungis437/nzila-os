import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));

vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: mocks.getStripeClient,
  verifyWebhookSignature: mocks.verifyWebhookSignature,
}));

import { stripe, verifyWebhookSignature } from '../stripe';

describe('lib/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily proxies property access to the platform Stripe client', () => {
    const fakeClient = { paymentIntents: { create: vi.fn() } };
    mocks.getStripeClient.mockReturnValue(fakeClient);

    // Access a property — the Proxy get trap should resolve the client now.
    expect(stripe.paymentIntents).toBe(fakeClient.paymentIntents);
    expect(mocks.getStripeClient).toHaveBeenCalled();
  });

  it('re-exports verifyWebhookSignature from the platform package', () => {
    expect(verifyWebhookSignature).toBe(mocks.verifyWebhookSignature);
  });
});
