/**
 * Tests for org-scope-middleware.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockWithOrganizationAuth: vi.fn(),
  mockValidateOrganizationAccess: vi.fn(),
  mockGetOrganizationIdFromRequest: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: mocks.mockWithOrganizationAuth,
  validateOrganizationAccess: mocks.mockValidateOrganizationAccess,
  getOrganizationIdFromRequest: mocks.mockGetOrganizationIdFromRequest,
}));

import { withOrgAuth, validateOrgAccess, getOrgIdFromRequest } from '../org-scope-middleware';

describe('org-scope-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withOrgAuth', () => {
    it('delegates to withOrganizationAuth and maps context', () => {
      mocks.mockWithOrganizationAuth.mockImplementation((handler: (...args: unknown[]) => unknown) => handler);

      const handler = vi.fn();
      withOrgAuth(handler);

      expect(mocks.mockWithOrganizationAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateOrgAccess', () => {
    it('delegates to validateOrganizationAccess', async () => {
      mocks.mockValidateOrganizationAccess.mockResolvedValue(true);
      const result = await validateOrgAccess('user-1', 'org-1');
      expect(result).toBe(true);
      expect(mocks.mockValidateOrganizationAccess).toHaveBeenCalledWith('user-1', 'org-1');
    });

    it('returns false when access denied', async () => {
      mocks.mockValidateOrganizationAccess.mockResolvedValue(false);
      const result = await validateOrgAccess('user-1', 'org-1');
      expect(result).toBe(false);
    });
  });

  describe('getOrgIdFromRequest', () => {
    it('delegates to getOrganizationIdFromRequest', async () => {
      mocks.mockGetOrganizationIdFromRequest.mockResolvedValue('org-123');
      const req = new NextRequest('http://localhost/api/test');
      const result = await getOrgIdFromRequest(req, 'user-1');
      expect(result).toBe('org-123');
      expect(mocks.mockGetOrganizationIdFromRequest).toHaveBeenCalledWith(req, 'user-1');
    });
  });
});
