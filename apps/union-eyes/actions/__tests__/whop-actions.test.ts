import { beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getProfileByUserId: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileByWhopUserId: vi.fn(),
  getProfileByEmail: vi.fn(),
  createProfile: vi.fn(),
  deleteProfileById: vi.fn(),
  getPendingProfileByEmail: vi.fn(),
  markPendingProfileAsClaimed: vi.fn(),
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/db/queries/profiles-queries', () => ({
  getProfileByUserId: mocks.getProfileByUserId,
  updateProfile: mocks.updateProfile,
  updateProfileByWhopUserId: mocks.updateProfileByWhopUserId,
  getProfileByEmail: mocks.getProfileByEmail,
  createProfile: mocks.createProfile,
  deleteProfileById: mocks.deleteProfileById,
}));

vi.mock('@/db/queries/pending-profiles-queries', () => ({
  getPendingProfileByEmail: mocks.getPendingProfileByEmail,
  markPendingProfileAsClaimed: mocks.markPendingProfileAsClaimed,
}));

vi.mock('@/lib/api-auth-guard', () => ({ auth: mocks.auth }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/logger', () => ({
  logger: { info: mocks.loggerInfo, warn: mocks.loggerWarn, error: mocks.loggerError },
}));

import {
  updateWhopCustomer,
  manageWhopMembershipStatusChange,
  canAccessPremiumFeatures,
  claimPendingProfile,
} from '../whop-actions';

describe('whop-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
    mocks.getProfileByUserId.mockResolvedValue(null);
    mocks.updateProfile.mockResolvedValue({ userId: 'user-1' });
    mocks.updateProfileByWhopUserId.mockResolvedValue({ userId: 'user-1' });
    mocks.getProfileByEmail.mockResolvedValue(null);
    mocks.createProfile.mockResolvedValue({ userId: 'user-1' });
    mocks.deleteProfileById.mockResolvedValue(undefined);
    mocks.getPendingProfileByEmail.mockResolvedValue(null);
    mocks.markPendingProfileAsClaimed.mockResolvedValue(undefined);
  });

  describe('updateWhopCustomer', () => {
    it('updates the profile with whop data', async () => {
      await updateWhopCustomer('user-1', 'whop-1', 'mem-1');
      expect(mocks.updateProfile).toHaveBeenCalledWith('user-1', expect.objectContaining({
        whopUserId: 'whop-1',
        whopMembershipId: 'mem-1',
        membership: 'pro',
      }));
      expect(mocks.revalidatePath).toHaveBeenCalled();
    });

    it('logs (does not throw) when parameters are missing', async () => {
      await expect(updateWhopCustomer('', 'whop-1', 'mem-1')).resolves.toBeUndefined();
      expect(mocks.loggerError).toHaveBeenCalled();
    });

    it('logs (does not throw) when update returns nothing', async () => {
      mocks.updateProfile.mockResolvedValue(null);
      await expect(updateWhopCustomer('user-1', 'whop-1', 'mem-1')).resolves.toBeUndefined();
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('manageWhopMembershipStatusChange', () => {
    it('maps active status to pro and updates the profile', async () => {
      await manageWhopMembershipStatusChange('mem-1', 'whop-1', 'active');
      expect(mocks.updateProfileByWhopUserId).toHaveBeenCalledWith('whop-1', {
        whopMembershipId: 'mem-1',
        membership: 'pro',
      });
      expect(mocks.loggerInfo).toHaveBeenCalled();
    });

    it('maps unknown status to free', async () => {
      await manageWhopMembershipStatusChange('mem-1', 'whop-1', 'expired');
      expect(mocks.updateProfileByWhopUserId).toHaveBeenCalledWith('whop-1', {
        whopMembershipId: 'mem-1',
        membership: 'free',
      });
    });

    it('logs an error when no profile is found', async () => {
      mocks.updateProfileByWhopUserId.mockResolvedValue(null);
      await manageWhopMembershipStatusChange('mem-1', 'whop-1', 'active');
      expect(mocks.loggerError).toHaveBeenCalled();
    });

    it('logs (does not throw) when parameters are missing', async () => {
      await expect(manageWhopMembershipStatusChange('', 'whop-1', 'active')).resolves.toBeUndefined();
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('canAccessPremiumFeatures', () => {
    it('returns false when not authenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      expect(await canAccessPremiumFeatures()).toBe(false);
    });

    it('returns true for pro members', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ membership: 'pro' });
      expect(await canAccessPremiumFeatures()).toBe(true);
    });

    it('returns false for non-pro members', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ membership: 'free' });
      expect(await canAccessPremiumFeatures()).toBe(false);
    });

    it('returns false and logs when lookup throws', async () => {
      mocks.getProfileByUserId.mockRejectedValue(new Error('boom'));
      expect(await canAccessPremiumFeatures()).toBe(false);
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('claimPendingProfile', () => {
    it('rejects when the caller is unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: false, error: 'Authentication required' });
    });

    it('rejects when claiming for another user', async () => {
      mocks.auth.mockResolvedValue({ userId: 'other' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r.success).toBe(false);
      expect(r.error).toContain('another user');
    });

    it('rejects when required parameters are missing', async () => {
      const r = await claimPendingProfile('user-1', '');
      expect(r.success).toBe(false);
      expect(r.error).toContain('Missing required parameters');
    });

    it('returns success early when the user is already pro', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ membership: 'pro' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: true });
    });

    it('returns an error when no pending profile is found', async () => {
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r.success).toBe(false);
      expect(r.error).toContain('No pending profile found');
    });

    it('rejects when the pending profile is claimed by another user', async () => {
      mocks.getPendingProfileByEmail.mockResolvedValue({ id: 'p1', claimed: true, claimedByUserId: 'other' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r.success).toBe(false);
      expect(r.error).toContain('already been claimed');
    });

    it('rejects on a token mismatch', async () => {
      mocks.getPendingProfileByEmail.mockResolvedValue({ id: 'p1', token: 'abc' });
      const r = await claimPendingProfile('user-1', 'a@x.com', 'xyz');
      expect(r).toEqual({ success: false, error: 'Invalid verification token' });
    });

    it('merges a pending profile into an existing (non-pro) profile', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ membership: 'free' });
      mocks.getPendingProfileByEmail.mockResolvedValue({ id: 'p1', membership: 'pro', paymentProvider: 'whop' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: true });
      expect(mocks.updateProfile).toHaveBeenCalled();
      expect(mocks.markPendingProfileAsClaimed).toHaveBeenCalledWith('p1', 'user-1');
    });

    it('creates a new profile when the user has none', async () => {
      mocks.getPendingProfileByEmail.mockResolvedValue({ id: 'p1', membership: 'free', paymentProvider: 'stripe' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: true });
      expect(mocks.createProfile).toHaveBeenCalled();
    });

    it('falls back to the legacy claim path for old temp profiles (creates profile)', async () => {
      mocks.getProfileByEmail.mockResolvedValue({ userId: 'temp_123', membership: 'pro', paymentProvider: 'whop' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: true });
      expect(mocks.createProfile).toHaveBeenCalled();
      expect(mocks.deleteProfileById).toHaveBeenCalledWith('temp_123');
    });

    it('legacy claim merges into an existing profile and cleans up', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ membership: 'free' });
      mocks.getProfileByEmail.mockResolvedValue({ userId: 'temp_123', membership: 'pro' });
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: true });
      expect(mocks.updateProfile).toHaveBeenCalled();
      expect(mocks.deleteProfileById).toHaveBeenCalledWith('temp_123');
    });

    it('legacy claim swallows cleanup errors', async () => {
      mocks.getProfileByEmail.mockResolvedValue({ userId: 'temp_123', membership: 'pro' });
      mocks.deleteProfileById.mockRejectedValue(new Error('cleanup fail'));
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r).toEqual({ success: true });
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it('returns an error when an unexpected failure occurs', async () => {
      mocks.getPendingProfileByEmail.mockRejectedValue(new Error('db down'));
      const r = await claimPendingProfile('user-1', 'a@x.com');
      expect(r.success).toBe(false);
      expect(r.error).toBe('db down');
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });
});
