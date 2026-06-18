import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  updateProfileByStripeCustomerId: vi.fn(),
  subRetrieve: vi.fn(),
  productRetrieve: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/db/queries/profiles-queries', () => ({
  updateProfile: mocks.updateProfile,
  updateProfileByStripeCustomerId: mocks.updateProfileByStripeCustomerId,
}));

vi.mock('@/db/schema', () => ({}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: { retrieve: mocks.subRetrieve },
    products: { retrieve: mocks.productRetrieve },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import { updateStripeCustomer, manageSubscriptionStatusChange } from '../stripe-actions';

describe('stripe-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subRetrieve.mockResolvedValue({ id: 'sub_1', status: 'active' });
    mocks.productRetrieve.mockResolvedValue({ metadata: { membership: 'pro' } });
    mocks.updateProfile.mockResolvedValue({ userId: 'user-1' });
    mocks.updateProfileByStripeCustomerId.mockResolvedValue({ userId: 'user-1' });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('updateStripeCustomer', () => {
    it('updates the profile with subscription data', async () => {
      const result = await updateStripeCustomer('user-1', 'sub_1', 'cus_1');
      expect(result).toEqual({ userId: 'user-1' });
      expect(mocks.updateProfile).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      });
    });

    it('throws when parameters are missing', async () => {
      await expect(updateStripeCustomer('', 'sub_1', 'cus_1')).rejects.toThrow('Missing required parameters');
    });

    it('throws when the profile update returns nothing', async () => {
      mocks.updateProfile.mockResolvedValue(null);
      await expect(updateStripeCustomer('user-1', 'sub_1', 'cus_1')).rejects.toThrow('Failed to update customer profile');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('manageSubscriptionStatusChange', () => {
    it('keeps membership for active subscriptions', async () => {
      const r = await manageSubscriptionStatusChange('sub_1', 'cus_1', 'prod_1');
      expect(r).toBe('pro');
    });

    it('keeps membership for trialing subscriptions', async () => {
      mocks.subRetrieve.mockResolvedValue({ id: 'sub_1', status: 'trialing' });
      const r = await manageSubscriptionStatusChange('sub_1', 'cus_1', 'prod_1');
      expect(r).toBe('pro');
    });

    it('downgrades to free for canceled subscriptions', async () => {
      mocks.subRetrieve.mockResolvedValue({ id: 'sub_1', status: 'canceled' });
      const r = await manageSubscriptionStatusChange('sub_1', 'cus_1', 'prod_1');
      expect(r).toBe('free');
    });

    it('downgrades to free for unknown subscription statuses', async () => {
      mocks.subRetrieve.mockResolvedValue({ id: 'sub_1', status: 'some_future_status' });
      const r = await manageSubscriptionStatusChange('sub_1', 'cus_1', 'prod_1');
      expect(r).toBe('free');
    });

    it('throws when parameters are missing', async () => {
      await expect(manageSubscriptionStatusChange('', 'cus_1', 'prod_1')).rejects.toThrow('Missing required parameters');
    });

    it('throws on an invalid membership type in product metadata', async () => {
      mocks.productRetrieve.mockResolvedValue({ metadata: { membership: 'enterprise' } });
      await expect(manageSubscriptionStatusChange('sub_1', 'cus_1', 'prod_1')).rejects.toThrow('Invalid membership type');
    });
  });
});
