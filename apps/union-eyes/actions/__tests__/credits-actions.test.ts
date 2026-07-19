import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getProfileByUserId: vi.fn(),
  updateProfile: vi.fn(),
  revalidatePath: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@/db/queries/profiles-queries', () => ({
  getProfileByUserId: mocks.getProfileByUserId,
  updateProfile: mocks.updateProfile,
}));

vi.mock('@/lib/api-auth-guard', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo },
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  withPremiumFeature,
  checkCredits,
  useCredits,
  getCreditStatus,
  hasReachedCreditLimit,
} from '../credits-actions';

type Profile = Record<string, unknown>;

function makeProfile(over: Profile = {}): Profile {
  return {
    userId: 'user-1',
    membership: 'pro',
    usageCredits: 100,
    usedCredits: 0,
    billingCycleEnd: null,
    nextCreditRenewal: null,
    ...over,
  };
}

const PAST = new Date(Date.now() - 86400000);
const FUTURE = new Date(Date.now() + 86400000);

describe('credits-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('checkCredits', () => {
    it('fails when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const r = await checkCredits(1);
      expect(r).toEqual({ hasCredits: false, profile: null, error: 'Not authenticated' });
    });

    it('fails when no profile exists', async () => {
      mocks.getProfileByUserId.mockResolvedValue(null);
      const r = await checkCredits(1);
      expect(r).toEqual({ hasCredits: false, profile: null, error: 'Profile not found' });
    });

    it('grants pro users with enough credits', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 10 }));
      const r = await checkCredits(5);
      expect(r.hasCredits).toBe(true);
    });

    it('denies pro users without enough credits', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 5, usedCredits: 5 }));
      const r = await checkCredits(3);
      expect(r.hasCredits).toBe(false);
      expect(r.error).toContain('Not enough credits');
    });

    it('renews credits when the renewal date has passed', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ nextCreditRenewal: PAST, usedCredits: 50 }),
      );
      mocks.updateProfile.mockResolvedValue(makeProfile({ usedCredits: 0, nextCreditRenewal: FUTURE }));
      const r = await checkCredits(1);
      expect(r.hasCredits).toBe(true);
      expect(mocks.updateProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({ usedCredits: 0 }));
      expect(mocks.loggerInfo).toHaveBeenCalled();
    });

    it('keeps credits when the renewal date is in the future', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ nextCreditRenewal: FUTURE }));
      const r = await checkCredits(1);
      expect(r.hasCredits).toBe(true);
      expect(mocks.updateProfile).not.toHaveBeenCalled();
    });

    it('reports profile lost after renewal returns null', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ nextCreditRenewal: PAST }));
      mocks.updateProfile.mockResolvedValue(null);
      const r = await checkCredits(1);
      expect(r).toEqual({
        hasCredits: false,
        profile: null,
        error: 'Profile not found after renewal check',
      });
    });

    it('downgrades a free user whose billing cycle has ended', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ membership: 'free', billingCycleEnd: PAST, usageCredits: 100 }),
      );
      mocks.updateProfile.mockResolvedValue(makeProfile({ membership: 'free', usageCredits: 5, usedCredits: 0 }));
      const r = await checkCredits(1);
      expect(mocks.updateProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({ usageCredits: 5 }));
      expect(r.hasCredits).toBe(true);
    });

    it('keeps a free user inside an active billing cycle (treated as pro)', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ membership: 'free', billingCycleEnd: FUTURE, usageCredits: 100, usedCredits: 0 }),
      );
      const r = await checkCredits(50);
      expect(r.hasCredits).toBe(true);
    });

    it('requires premium when a free user requests more than 5 credits', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ membership: 'free', billingCycleEnd: null, usageCredits: 5, usedCredits: 0 }),
      );
      const r = await checkCredits(6);
      expect(r.hasCredits).toBe(false);
      expect(r.error).toContain('premium membership');
    });

    it('denies a free user without enough free-tier credits', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ membership: 'free', billingCycleEnd: null, usageCredits: 5, usedCredits: 5 }),
      );
      const r = await checkCredits(3);
      expect(r.hasCredits).toBe(false);
      expect(r.error).toContain('Not enough credits');
    });

    it('grants a free user with enough free-tier credits', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ membership: 'free', billingCycleEnd: null, usageCredits: 5, usedCredits: 0 }),
      );
      const r = await checkCredits(2);
      expect(r.hasCredits).toBe(true);
    });

    it('returns a server error when the lookup throws', async () => {
      mocks.getProfileByUserId.mockRejectedValue(new Error('boom'));
      const r = await checkCredits(1);
      expect(r).toEqual({ hasCredits: false, profile: null, error: 'Server error checking credits' });
    });
  });

  describe('useCredits', () => {
    it('fails when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const r = await useCredits(1);
      expect(r).toEqual({ success: false, error: 'Not authenticated' });
    });

    it('fails when the credit check denies', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 1, usedCredits: 1 }));
      const r = await useCredits(5);
      expect(r.success).toBe(false);
    });

    it('uses credits and updates the profile', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 0 }));
      mocks.updateProfile.mockResolvedValue(makeProfile({ usedCredits: 5 }));
      const r = await useCredits(5, 'AI feature');
      expect(r.success).toBe(true);
      expect(mocks.updateProfile).toHaveBeenCalledWith('user-1', { usedCredits: 5 });
    });

    it('returns failure when the update throws', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 0 }));
      mocks.updateProfile.mockRejectedValue(new Error('db down'));
      const r = await useCredits(5);
      expect(r).toEqual({ success: false, error: 'Failed to use credits' });
    });
  });

  describe('withPremiumFeature', () => {
    it('returns the feature result on success', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 0 }));
      mocks.updateProfile.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 5 }));

      const r = await withPremiumFeature(async () => ({ ok: true }), {
        creditsRequired: 5,
        featureName: 'AI',
      });

      expect(r.success).toBe(true);
      expect(r.data).toEqual({ ok: true });
      expect(r.creditsRemaining).toBe(95);
    });

    it('returns error with remaining credits when the check denies (profile present)', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 5, usedCredits: 5 }));

      const r = await withPremiumFeature(async () => ({ ok: true }), {
        creditsRequired: 3,
        featureName: 'AI',
      });

      expect(r.success).toBe(false);
      expect(r.creditsRemaining).toBe(0);
    });

    it('returns error with zero remaining when no profile (unauthenticated)', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const r = await withPremiumFeature(async () => ({ ok: true }), {
        creditsRequired: 1,
        featureName: 'AI',
      });

      expect(r.success).toBe(false);
      expect(r.creditsRemaining).toBe(0);
    });

    it('returns error when using credits fails', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 0 }));
      mocks.updateProfile.mockRejectedValue(new Error('db down'));

      const r = await withPremiumFeature(async () => ({ ok: true }), {
        creditsRequired: 5,
        featureName: 'AI',
      });

      expect(r.success).toBe(false);
      expect(r.error).toBe('Failed to use credits');
    });

    it('catches errors thrown by the feature function', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 0 }));
      mocks.updateProfile.mockResolvedValue(makeProfile({ usageCredits: 100, usedCredits: 5 }));

      const r = await withPremiumFeature(
        async () => {
          throw new Error('feature blew up');
        },
        { creditsRequired: 5, featureName: 'AI' },
      );

      expect(r.success).toBe(false);
      expect(r.error).toBe('feature blew up');
    });
  });

  describe('getCreditStatus', () => {
    it('returns defaults when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const r = await getCreditStatus();
      expect(r.error).toBe('Not authenticated');
      expect(r.membership).toBe('free');
    });

    it('returns defaults when no profile exists', async () => {
      mocks.getProfileByUserId.mockResolvedValue(null);
      const r = await getCreditStatus();
      expect(r.error).toBe('Profile not found');
    });

    it('returns the credit status for a profile', async () => {
      mocks.getProfileByUserId.mockResolvedValue(
        makeProfile({ usageCredits: 100, usedCredits: 30, billingCycleEnd: FUTURE, membership: 'pro' }),
      );
      const r = await getCreditStatus();
      expect(r).toMatchObject({ total: 100, used: 30, remaining: 70, membership: 'pro' });
    });

    it('returns defaults when the lookup throws', async () => {
      mocks.getProfileByUserId.mockRejectedValue(new Error('boom'));
      const r = await getCreditStatus();
      expect(r.error).toBe('Failed to get credit status');
    });
  });

  describe('hasReachedCreditLimit', () => {
    it('returns false when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      expect(await hasReachedCreditLimit()).toBe(false);
    });

    it('returns false when no profile exists', async () => {
      mocks.getProfileByUserId.mockResolvedValue(null);
      expect(await hasReachedCreditLimit()).toBe(false);
    });

    it('returns true when used credits meet the allowance', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 10, usedCredits: 10 }));
      expect(await hasReachedCreditLimit()).toBe(true);
    });

    it('returns false when credits remain', async () => {
      mocks.getProfileByUserId.mockResolvedValue(makeProfile({ usageCredits: 10, usedCredits: 3 }));
      expect(await hasReachedCreditLimit()).toBe(false);
    });

    it('returns false when the lookup throws', async () => {
      mocks.getProfileByUserId.mockRejectedValue(new Error('boom'));
      expect(await hasReachedCreditLimit()).toBe(false);
    });
  });
});
