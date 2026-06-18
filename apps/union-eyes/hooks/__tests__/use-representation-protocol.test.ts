// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  mockUseOrg: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/lib/org-context', () => ({
  useOrg: mocks.mockUseOrg,
}));

vi.mock('@/lib/representation/protocol-types', () => ({
  PROTOCOL_STEWARD_LED: { mode: 'steward-led' },
}));

import { useRepresentationProtocol } from '../use-representation-protocol';

describe('hooks/use-representation-protocol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockUseOrg.mockReturnValue({ currentOrg: { organizationId: 'org-1' } });
    globalThis.fetch = mocks.mockFetch as unknown as typeof fetch;
  });

  afterEach(() => cleanup());

  it('stops loading without fetching when there is no organization', async () => {
    mocks.mockUseOrg.mockReturnValue({ currentOrg: null });

    const { result } = renderHook(() => useRepresentationProtocol());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.mockFetch).not.toHaveBeenCalled();
    expect(result.current.protocol).toEqual({ mode: 'steward-led' });
  });

  it('loads the protocol from the API', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ protocol: { mode: 'member-led' } }),
    });

    const { result } = renderHook(() => useRepresentationProtocol());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.protocol).toEqual({ mode: 'member-led' });
    expect(result.current.error).toBeNull();
  });

  it('falls back to the steward-led default when the API omits a protocol', async () => {
    mocks.mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useRepresentationProtocol());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.protocol).toEqual({ mode: 'steward-led' });
  });

  it('records an error and keeps the default on a failed response', async () => {
    mocks.mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderHook(() => useRepresentationProtocol());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('HTTP 500');
    expect(result.current.protocol).toEqual({ mode: 'steward-led' });
  });

  it('refetch re-requests the protocol', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ protocol: { mode: 'member-led' } }),
    });

    const { result } = renderHook(() => useRepresentationProtocol());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = mocks.mockFetch.mock.calls.length;

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() =>
      expect(mocks.mockFetch.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
