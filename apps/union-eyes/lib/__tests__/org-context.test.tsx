// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseOrganization: vi.fn(),
  mockFetch: vi.fn(),
  mockReload: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/client', () => ({
  useAuth: mocks.mockUseAuth,
  useOrganization: mocks.mockUseOrganization,
}));

import { OrgProvider, useOrg, useOrgId, useOrgFeatures, useOrgTier } from '../org-context';

function makeWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(OrgProvider, null, children);
  };
}

describe('org-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseAuth.mockReturnValue({ userId: 'user-1', isLoaded: true });
    mocks.mockUseOrganization.mockReturnValue({ organization: { id: 'org-1' }, isLoaded: true });

    // Default: /api/org/current returns a valid org
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        org: {
          organizationId: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          features: ['feature-a', 'feature-b'],
        },
        availableOrgs: [
          { organizationId: 'org-1', name: 'Test Org', slug: 'test-org', features: ['feature-a', 'feature-b'] },
        ],
      }),
    });

    globalThis.fetch = mocks.mockFetch as any as typeof fetch;

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: mocks.mockReload },
      writable: true,
    });
  });

  describe('useOrg', () => {
    it('throws when used outside OrgProvider', () => {
      // renderHook without wrapper
      expect(() => {
        renderHook(() => useOrg());
      }).toThrow('useOrg must be used within an OrgProvider');
    });

    it('fetches current org info on mount', async () => {
      const { result } = renderHook(() => useOrg(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.currentOrg?.name).toBe('Test Org');
      expect(result.current.orgs).toHaveLength(1);
      expect(result.current.error).toBeNull();
    });

    it('sets error when fetch fails', async () => {
      mocks.mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useOrg(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to fetch org info');
    });

    it('does not fetch when userId is null', async () => {
      mocks.mockUseAuth.mockReturnValue({ userId: null, isLoaded: true });

      const { result } = renderHook(() => useOrg(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(mocks.mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('useOrgId', () => {
    it('returns current organization ID', async () => {
      const { result } = renderHook(() => useOrgId(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toBe('org-1'));
    });
  });

  describe('useOrgFeatures', () => {
    it('returns true when all required features are present', async () => {
      const { result } = renderHook(() => useOrgFeatures(['feature-a']), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it('returns false when a required feature is missing', async () => {
      const { result } = renderHook(() => useOrgFeatures(['feature-a', 'feature-z']), {
        wrapper: makeWrapper(),
      });

      // Wait for org data to load, then check
      await waitFor(() => {
        // After loading, feature-z is not present
      });
      // Give time for state to settle
      await waitFor(() => expect(result.current).toBe(false));
    });
  });

  describe('switchOrg', () => {
    it('calls /api/org/switch and reloads the page', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            org: { organizationId: 'org-1', name: 'Test Org', slug: 'test-org', features: [] },
            availableOrgs: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            org: { organizationId: 'org-2', name: 'Other Org', slug: 'other-org' },
          }),
        });

      const { result } = renderHook(() => useOrg(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.switchOrg('org-2');
      });

      expect(mocks.mockFetch).toHaveBeenCalledWith('/api/org/switch', expect.objectContaining({
        method: 'POST',
      }));
      expect(mocks.mockReload).toHaveBeenCalled();
    });
  });

  describe('refreshOrgs', () => {
    it('re-fetches org info via fetchOrgInfo', async () => {
      const { result } = renderHook(() => useOrg(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const callsBefore = mocks.mockFetch.mock.calls.length;

      await act(async () => {
        await result.current.refreshOrgs();
      });

      expect(mocks.mockFetch.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(mocks.mockFetch).toHaveBeenLastCalledWith('/api/org/current', expect.any(Object));
    });
  });

  describe('useOrgTier', () => {
    it('returns the current organization subscription tier', async () => {
      mocks.mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          org: {
            organizationId: 'org-1',
            name: 'Test Org',
            slug: 'test-org',
            subscriptionTier: 'enterprise',
          },
          availableOrgs: [],
        }),
      });

      const { result } = renderHook(() => useOrgTier(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current).toBe('enterprise'));
    });

    it('returns null when no subscription tier is set', async () => {
      const { result } = renderHook(() => useOrgTier(), { wrapper: makeWrapper() });

      // The default org has no subscriptionTier.
      await waitFor(() => expect(result.current).toBeNull());
    });
  });
});
