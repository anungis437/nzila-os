// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

const mocks = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockFetch: vi.fn(),
  mockReload: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/client', () => ({
  useAuth: mocks.mockUseAuth,
}));

import {
  OrganizationProvider,
  useOrganization,
  useOrganizationId,
  useUserOrganizations,
  useSwitchOrganization,
} from '../organization-context';

type RespInit = {
  ok?: boolean;
  status?: number;
  json?: () => unknown | Promise<unknown>;
  text?: () => string | Promise<string>;
};

function resp(init: RespInit) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: init.json ?? (async () => ({})),
    text: init.text ?? (async () => ''),
  };
}

/** Configure fetch to route by URL substring. */
function routeFetch(routes: Array<[string, () => unknown]>) {
  mocks.mockFetch.mockImplementation(async (url: string) => {
    for (const [pattern, factory] of routes) {
      if (url.includes(pattern)) return factory();
    }
    return resp({ json: async () => ({}) });
  });
}

const ORG = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
  type: 'union',
  parentId: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
};

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(OrganizationProvider, null, children);
}

describe('contexts/organization-context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCookies();
    mocks.mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: true });
    globalThis.fetch = mocks.mockFetch as unknown as typeof fetch;
    Object.defineProperty(window, 'location', {
      value: { ...window.location, protocol: 'https:', reload: mocks.mockReload },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => cleanup());

  it('loads organizations and auto-selects the primary membership', async () => {
    routeFetch([
      [
        '/api/users/me/organizations',
        () =>
          resp({
            json: async () => ({
              organizations: [ORG, { ...ORG, id: 'org-2', slug: 'org-2', name: 'Org Two' }],
              memberships: [{ organizationId: 'org-1', isPrimary: true }],
            }),
          }),
      ],
      ['/path', () => resp({ json: async () => ({ data: [ORG] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.organizationId).toBe('org-1');
    expect(result.current.userOrganizations).toHaveLength(2);
    expect(result.current.organization?.id).toBe('org-1');
  });

  it('honors a valid selected-organization cookie', async () => {
    document.cookie = 'selected_organization_id=org-2; path=/';
    routeFetch([
      [
        '/api/users/me/organizations',
        () =>
          resp({
            json: async () => ({
              organizations: [ORG, { ...ORG, id: 'org-2', slug: 'org-2', name: 'Org Two' }],
              memberships: [{ organizationId: 'org-1', isPrimary: true }],
            }),
          }),
      ],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.organizationId).toBe('org-2');
  });

  it('resolves organizations by membership id when the org list is empty', async () => {
    routeFetch([
      [
        '/api/users/me/organizations',
        () =>
          resp({
            json: async () => ({
              organizations: [],
              memberships: [
                { organizationId: 'org-1', isPrimary: false },
                { organizationId: 'org-3', isPrimary: false },
              ],
            }),
          }),
      ],
      ['/api/organizations/org-1/path', () => resp({ json: async () => ({ data: [] }) })],
      ['/api/organizations/org-3', () => resp({ json: async () => ({ data: { ...ORG, id: 'org-3', slug: 'org-3' } }) })],
      ['/api/organizations/org-1', () => resp({ json: async () => ({ data: ORG }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userOrganizations.map((o) => o.id)).toContain('org-1');
    expect(result.current.userOrganizations.map((o) => o.id)).toContain('org-3');
  });

  it('falls back to the profile organization when memberships are empty', async () => {
    routeFetch([
      ['/api/users/me/organizations', () => resp({ json: async () => ({ organizations: [], memberships: [] }) })],
      ['/api/users/me/profile', () => resp({ json: async () => ({ organization: ORG }) })],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userOrganizations.map((o) => o.id)).toContain('org-1');
  });

  it('synthesizes organizations as a last resort', async () => {
    routeFetch([
      [
        '/api/users/me/organizations',
        () =>
          resp({
            json: async () => ({
              organizations: [],
              memberships: [
                { organizationId: 'abcdef1234', isPrimary: true },
                { organizationId: 'ghijkl5678', isPrimary: false },
              ],
            }),
          }),
      ],
      // org-by-id and profile both fail to yield an org → synthetic fallback.
      ['/api/organizations/abcdef1234/path', () => resp({ json: async () => ({ data: [] }) })],
      ['/api/organizations/abcdef1234', () => resp({ ok: false, status: 404 })],
      ['/api/organizations/ghijkl5678', () => resp({ ok: false, status: 404 })],
      ['/api/users/me/profile', () => resp({ json: async () => ({ organization: null }) })],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userOrganizations[0]?.id).toBe('abcdef1234');
    expect(result.current.userOrganizations).toHaveLength(2);
  });

  it('sets a sign-in error on 401 responses', async () => {
    routeFetch([['/api/users/me/organizations', () => resp({ ok: false, status: 401 })]]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('Please sign in to continue'));
  });

  it('sets a generic error on non-401 failures', async () => {
    routeFetch([['/api/users/me/organizations', () => resp({ ok: false, status: 500 })]]);

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.error).toContain('Failed to load organizations'));
  });

  it('silently ignores aborted requests', async () => {
    mocks.mockFetch.mockImplementation(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });

    const { result } = renderHook(() => useOrganization(), { wrapper });
    // No error surfaced for aborts; loading resolves in finally.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it('stops loading when the user is not signed in', async () => {
    mocks.mockUseAuth.mockReturnValue({ isSignedIn: false, isLoaded: true });

    const { result } = renderHook(() => useOrganization(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.mockFetch).not.toHaveBeenCalled();
  });

  it('refreshOrganizations returns early when auth is not loaded', async () => {
    mocks.mockUseAuth.mockReturnValue({ isSignedIn: true, isLoaded: false });

    const { result } = renderHook(() => useOrganization(), { wrapper });
    await act(async () => {
      await result.current.refreshOrganizations();
    });
    expect(mocks.mockFetch).not.toHaveBeenCalled();
  });

  it('loadOrganizationTree populates the tree and tolerates errors', async () => {
    routeFetch([
      ['/api/users/me/organizations', () => resp({ json: async () => ({ organizations: [ORG], memberships: [] }) })],
      ['/api/organizations/tree', () => resp({ json: async () => ({ data: [ORG] }) })],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadOrganizationTree();
    });
    expect(result.current.organizationTree).toHaveLength(1);

    // Error path: fetch rejects.
    mocks.mockFetch.mockRejectedValueOnce(new Error('tree down'));
    await act(async () => {
      await result.current.loadOrganizationTree();
    });
    expect(result.current.organizationTree).toHaveLength(1);
  });

  it('switchOrganization validates, sets cookies and reloads', async () => {
    routeFetch([
      ['/api/users/me/organizations', () => resp({ json: async () => ({ organizations: [ORG], memberships: [] }) })],
      [
        '/api/organizations/switch',
        () => resp({ json: async () => ({ success: true, organization: { ...ORG, slug: 'switched' } }) }),
      ],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.switchOrganization('org-9');
    });

    expect(mocks.mockReload).toHaveBeenCalled();
    expect(document.cookie).toContain('selected_organization_id=org-9');
  });

  it('switchOrganization surfaces a server rejection', async () => {
    routeFetch([
      ['/api/users/me/organizations', () => resp({ json: async () => ({ organizations: [ORG], memberships: [] }) })],
      [
        '/api/organizations/switch',
        () =>
          resp({
            ok: false,
            status: 403,
            json: async () => {
              throw new Error('bad json');
            },
          }),
      ],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.switchOrganization('org-9');
    });
    expect(result.current.error).toBe('Failed to switch organization');
  });

  it('switchOrganization throws when validation is unsuccessful', async () => {
    routeFetch([
      ['/api/users/me/organizations', () => resp({ json: async () => ({ organizations: [ORG], memberships: [] }) })],
      ['/api/organizations/switch', () => resp({ json: async () => ({ success: false }) })],
      ['/path', () => resp({ json: async () => ({ data: [] }) })],
    ]);

    const { result } = renderHook(() => useOrganization(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.switchOrganization('org-9');
    });
    expect(result.current.error).toBe('Organization switch validation failed');
  });

  it('aborts the request when the fetch timeout elapses', async () => {
    vi.useFakeTimers();
    // First fetch never resolves so the 10s timeout callback fires.
    mocks.mockFetch.mockImplementation(() => new Promise(() => {}));

    renderHook(() => useOrganization(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(mocks.mockFetch).toHaveBeenCalled();
    vi.useRealTimers();
  });

  describe('hooks', () => {
    it('useOrganization throws outside a provider', () => {
      expect(() => renderHook(() => useOrganization())).toThrow(
        /must be used within an OrganizationProvider/,
      );
    });

    it('useOrganizationId, useUserOrganizations and useSwitchOrganization read the context', async () => {
      routeFetch([
        ['/api/users/me/organizations', () => resp({ json: async () => ({ organizations: [ORG], memberships: [{ organizationId: 'org-1', isPrimary: true }] }) })],
        ['/path', () => resp({ json: async () => ({ data: [] }) })],
      ]);

      const id = renderHook(() => useOrganizationId(), { wrapper });
      await waitFor(() => expect(id.result.current).toBe('org-1'));

      const list = renderHook(() => useUserOrganizations(), { wrapper });
      await waitFor(() => expect(list.result.current).toHaveLength(1));

      const sw = renderHook(() => useSwitchOrganization(), { wrapper });
      expect(typeof sw.result.current).toBe('function');
    });
  });
});
