import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOrganizationIdForUser: vi.fn(),
}));

vi.mock('../organization-utils', () => ({
  getOrganizationIdForUser: mocks.getOrganizationIdForUser,
}));

import { isAppOrgUuid, resolveOrgIdFromContext } from '../org-id-from-context';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('lib/org-id-from-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAppOrgUuid', () => {
    it('accepts a well-formed UUID', () => {
      expect(isAppOrgUuid(VALID_UUID)).toBe(true);
    });

    it('rejects non-UUID strings and non-strings', () => {
      expect(isAppOrgUuid('not-a-uuid')).toBe(false);
      expect(isAppOrgUuid('')).toBe(false);
      expect(isAppOrgUuid(null)).toBe(false);
      expect(isAppOrgUuid(42)).toBe(false);
    });
  });

  describe('resolveOrgIdFromContext', () => {
    it('prefers a valid context org id without hitting the resolver', async () => {
      const result = await resolveOrgIdFromContext({ organizationId: VALID_UUID }, 'user-1');
      expect(result).toBe(VALID_UUID);
      expect(mocks.getOrganizationIdForUser).not.toHaveBeenCalled();
    });

    it('falls back to the canonical resolver and returns a valid UUID', async () => {
      mocks.getOrganizationIdForUser.mockResolvedValue(VALID_UUID);
      const result = await resolveOrgIdFromContext({ organizationId: 'bad' }, 'user-1');
      expect(result).toBe(VALID_UUID);
      expect(mocks.getOrganizationIdForUser).toHaveBeenCalledWith('user-1');
    });

    it('returns null when the resolver yields a non-UUID', async () => {
      mocks.getOrganizationIdForUser.mockResolvedValue('group-guid');
      const result = await resolveOrgIdFromContext({ organizationId: null }, 'user-1');
      expect(result).toBeNull();
    });

    it('returns null when the resolver yields nothing', async () => {
      mocks.getOrganizationIdForUser.mockResolvedValue(null);
      const result = await resolveOrgIdFromContext({}, 'user-1');
      expect(result).toBeNull();
    });
  });
});
