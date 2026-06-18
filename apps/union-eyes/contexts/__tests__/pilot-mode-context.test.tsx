// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

import { PilotModeProvider, usePilotMode } from '../pilot-mode-context';

const ONBOARDING_KEY = 'ue-pilot-onboarding-complete';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(PilotModeProvider, null, children);
}

describe('contexts/pilot-mode-context', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => cleanup());

  it('reads completed onboarding and enables pilot mode from the flag', async () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) });

    const { result } = renderHook(() => usePilotMode(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(result.current.isPilotMode).toBe(true);
  });

  it('defaults pilot mode to false when the flag is absent', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => usePilotMode(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPilotMode).toBe(false);
    expect(result.current.hasCompletedOnboarding).toBe(false);
  });

  it('leaves pilot mode false when the flag endpoint is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ enabled: true }) });

    const { result } = renderHook(() => usePilotMode(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPilotMode).toBe(false);
  });

  it('tolerates a failing flag fetch', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => usePilotMode(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPilotMode).toBe(false);
  });

  it('tolerates localStorage being unavailable on read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) });

    const { result } = renderHook(() => usePilotMode(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasCompletedOnboarding).toBe(false);
  });

  it('completeOnboarding persists to localStorage and updates state', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) });

    const { result } = renderHook(() => usePilotMode(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.completeOnboarding();
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('true');
  });

  it('completeOnboarding ignores a localStorage write failure', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ enabled: false }) });

    const { result } = renderHook(() => usePilotMode(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    act(() => {
      result.current.completeOnboarding();
    });

    expect(result.current.hasCompletedOnboarding).toBe(true);
  });

  it('provides default context values outside a provider', () => {
    const { result } = renderHook(() => usePilotMode());

    expect(result.current.isPilotMode).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasCompletedOnboarding).toBe(false);
    // Default completeOnboarding is a no-op and must not throw.
    expect(() => result.current.completeOnboarding()).not.toThrow();
  });
});
