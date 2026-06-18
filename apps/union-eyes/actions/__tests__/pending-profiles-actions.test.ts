import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  loggerError: vi.fn(),
  getPendingProfileByEmail: vi.fn(),
  getUnclaimedPendingProfiles: vi.fn(),
  markPendingProfileAsClaimed: vi.fn(),
  deletePendingProfile: vi.fn(),
}));

vi.mock('@/db/queries/pending-profiles-queries', () => ({
  getPendingProfileByEmail: mocks.getPendingProfileByEmail,
  getUnclaimedPendingProfiles: mocks.getUnclaimedPendingProfiles,
  markPendingProfileAsClaimed: mocks.markPendingProfileAsClaimed,
  deletePendingProfile: mocks.deletePendingProfile,
}));

vi.mock('@/lib/auth/rbac-server', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.loggerError } }));

import {
  getPendingProfileByEmailAction,
  getUnclaimedPendingProfilesAction,
  markPendingProfileAsClaimedAction,
  deletePendingProfileAction,
} from '../pending-profiles-actions';

describe('pending-profiles-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ userId: 'user-1' });
    mocks.getPendingProfileByEmail.mockResolvedValue({ email: 'a@b.com' });
    mocks.getUnclaimedPendingProfiles.mockResolvedValue([{ id: '1' }]);
    mocks.markPendingProfileAsClaimed.mockResolvedValue({ id: '1', claimed: true });
    mocks.deletePendingProfile.mockResolvedValue({ id: '1' });
  });

  afterEach(() => vi.restoreAllMocks());

  it('getPendingProfileByEmailAction returns data then handles errors', async () => {
    expect(await getPendingProfileByEmailAction('a@b.com')).toEqual({
      success: true,
      data: { email: 'a@b.com' },
    });

    mocks.getPendingProfileByEmail.mockRejectedValueOnce(new Error('x'));
    const fail = await getPendingProfileByEmailAction('a@b.com');
    expect(fail).toEqual({ success: false, error: 'Failed to get pending profile' });
    expect(mocks.loggerError).toHaveBeenCalled();
  });

  it('getUnclaimedPendingProfilesAction returns data then handles errors', async () => {
    expect(await getUnclaimedPendingProfilesAction()).toEqual({
      success: true,
      data: [{ id: '1' }],
    });

    mocks.getUnclaimedPendingProfiles.mockRejectedValueOnce(new Error('x'));
    expect(await getUnclaimedPendingProfilesAction()).toEqual({
      success: false,
      error: 'Failed to get unclaimed profiles',
    });
  });

  it('markPendingProfileAsClaimedAction returns data then handles errors', async () => {
    expect(await markPendingProfileAsClaimedAction('1', 'user-1')).toEqual({
      success: true,
      data: { id: '1', claimed: true },
    });

    mocks.markPendingProfileAsClaimed.mockRejectedValueOnce(new Error('x'));
    expect(await markPendingProfileAsClaimedAction('1', 'user-1')).toEqual({
      success: false,
      error: 'Failed to mark profile as claimed',
    });
  });

  it('deletePendingProfileAction returns data then handles errors', async () => {
    expect(await deletePendingProfileAction('1')).toEqual({
      success: true,
      data: { id: '1' },
    });

    mocks.deletePendingProfile.mockRejectedValueOnce(new Error('x'));
    expect(await deletePendingProfileAction('1')).toEqual({
      success: false,
      error: 'Failed to delete pending profile',
    });
  });

  it('propagates auth failures into the catch branch', async () => {
    mocks.requireAuth.mockRejectedValueOnce(new Error('not authed'));
    const r = await getUnclaimedPendingProfilesAction();
    expect(r.success).toBe(false);
  });
});
