import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  getAllProfiles: vi.fn(),
  getProfileByUserId: vi.fn(),
  updateProfile: vi.fn(),
  getUserPlanInfo: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/db/queries/profiles-queries', () => ({
  createProfile: mocks.createProfile,
  deleteProfile: mocks.deleteProfile,
  getAllProfiles: mocks.getAllProfiles,
  getProfileByUserId: mocks.getProfileByUserId,
  updateProfile: mocks.updateProfile,
  getUserPlanInfo: mocks.getUserPlanInfo,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api-auth-guard', () => ({
  auth: mocks.auth,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

import {
  createProfileAction,
  getProfileByUserIdAction,
  getAllProfilesAction,
  updateProfileAction,
  deleteProfileAction,
  checkPaymentFailedAction,
  getUserPlanInfoAction,
} from '../profiles-actions';

const PROFILE = { userId: 'user-1', status: 'active' } as never;

describe('profiles-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: 'user-1' });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('createProfileAction', () => {
    it('creates a profile when authenticated', async () => {
      mocks.createProfile.mockResolvedValue(PROFILE);

      const result = await createProfileAction(PROFILE);

      expect(result).toEqual({
        isSuccess: true,
        message: 'Profile created successfully',
        data: PROFILE,
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/');
    });

    it('rejects when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const result = await createProfileAction(PROFILE);

      expect(result).toEqual({ isSuccess: false, message: 'Unauthorized' });
      expect(mocks.createProfile).not.toHaveBeenCalled();
    });

    it('returns failure when creation throws', async () => {
      mocks.createProfile.mockRejectedValue(new Error('db down'));

      const result = await createProfileAction(PROFILE);

      expect(result).toEqual({ isSuccess: false, message: 'Failed to create profile' });
    });
  });

  describe('getProfileByUserIdAction', () => {
    it('returns the profile', async () => {
      mocks.getProfileByUserId.mockResolvedValue(PROFILE);

      const result = await getProfileByUserIdAction('user-1');

      expect(result).toEqual({
        isSuccess: true,
        message: 'Profile retrieved successfully',
        data: PROFILE,
      });
    });

    it('returns failure on error', async () => {
      mocks.getProfileByUserId.mockRejectedValue(new Error('boom'));

      const result = await getProfileByUserIdAction('user-1');

      expect(result).toEqual({ isSuccess: false, message: 'Failed to get profiles' });
    });
  });

  describe('getAllProfilesAction', () => {
    it('returns all profiles', async () => {
      mocks.getAllProfiles.mockResolvedValue([PROFILE]);

      const result = await getAllProfilesAction();

      expect(result).toEqual({
        isSuccess: true,
        message: 'Profiles retrieved successfully',
        data: [PROFILE],
      });
    });

    it('returns failure on error', async () => {
      mocks.getAllProfiles.mockRejectedValue(new Error('boom'));

      const result = await getAllProfilesAction();

      expect(result).toEqual({ isSuccess: false, message: 'Failed to get profiles' });
    });
  });

  describe('updateProfileAction', () => {
    it('updates when authenticated', async () => {
      mocks.updateProfile.mockResolvedValue(PROFILE);

      const result = await updateProfileAction('user-1', { status: 'active' } as never);

      expect(result).toEqual({
        isSuccess: true,
        message: 'Profile updated successfully',
        data: PROFILE,
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/');
    });

    it('rejects when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const result = await updateProfileAction('user-1', {} as never);

      expect(result).toEqual({ isSuccess: false, message: 'Unauthorized' });
      expect(mocks.updateProfile).not.toHaveBeenCalled();
    });

    it('returns failure when update throws', async () => {
      mocks.updateProfile.mockRejectedValue(new Error('boom'));

      const result = await updateProfileAction('user-1', {} as never);

      expect(result).toEqual({ isSuccess: false, message: 'Failed to update profile' });
    });
  });

  describe('deleteProfileAction', () => {
    it('deletes when authenticated', async () => {
      mocks.deleteProfile.mockResolvedValue(undefined);

      const result = await deleteProfileAction('user-1');

      expect(result).toEqual({ isSuccess: true, message: 'Profile deleted successfully' });
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/');
    });

    it('rejects when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const result = await deleteProfileAction('user-1');

      expect(result).toEqual({ isSuccess: false, message: 'Unauthorized' });
      expect(mocks.deleteProfile).not.toHaveBeenCalled();
    });

    it('returns failure when delete throws', async () => {
      mocks.deleteProfile.mockRejectedValue(new Error('boom'));

      const result = await deleteProfileAction('user-1');

      expect(result).toEqual({ isSuccess: false, message: 'Failed to delete profile' });
    });
  });

  describe('checkPaymentFailedAction', () => {
    it('reports payment failed when status is payment_failed', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ status: 'payment_failed' });

      const result = await checkPaymentFailedAction();

      expect(result).toEqual({ paymentFailed: true });
    });

    it('reports not failed for other statuses', async () => {
      mocks.getProfileByUserId.mockResolvedValue({ status: 'active' });

      const result = await checkPaymentFailedAction();

      expect(result).toEqual({ paymentFailed: false });
    });

    it('returns false when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const result = await checkPaymentFailedAction();

      expect(result).toEqual({ paymentFailed: false });
      expect(mocks.getProfileByUserId).not.toHaveBeenCalled();
    });

    it('returns false and logs on error', async () => {
      mocks.getProfileByUserId.mockRejectedValue(new Error('boom'));

      const result = await checkPaymentFailedAction();

      expect(result).toEqual({ paymentFailed: false });
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });

  describe('getUserPlanInfoAction', () => {
    const PLAN = {
      membership: 'pro',
      planDuration: 'monthly',
      status: 'active',
      usageCredits: 100,
      usedCredits: 10,
      billingCycleStart: null,
      billingCycleEnd: null,
      nextCreditRenewal: null,
    };

    it('returns the plan info', async () => {
      mocks.getUserPlanInfo.mockResolvedValue(PLAN);

      const result = await getUserPlanInfoAction();

      expect(result).toEqual({
        isSuccess: true,
        message: 'Plan information retrieved successfully',
        data: PLAN,
      });
    });

    it('returns failure when unauthenticated', async () => {
      mocks.auth.mockResolvedValue({ userId: null });

      const result = await getUserPlanInfoAction();

      expect(result).toEqual({ isSuccess: false, message: 'User not authenticated' });
      expect(mocks.getUserPlanInfo).not.toHaveBeenCalled();
    });

    it('returns failure when no plan info found', async () => {
      mocks.getUserPlanInfo.mockResolvedValue(null);

      const result = await getUserPlanInfoAction();

      expect(result).toEqual({ isSuccess: false, message: 'No plan information found' });
    });

    it('returns failure and logs on error', async () => {
      mocks.getUserPlanInfo.mockRejectedValue(new Error('boom'));

      const result = await getUserPlanInfoAction();

      expect(result).toEqual({ isSuccess: false, message: 'Failed to get plan information' });
      expect(mocks.loggerError).toHaveBeenCalled();
    });
  });
});
