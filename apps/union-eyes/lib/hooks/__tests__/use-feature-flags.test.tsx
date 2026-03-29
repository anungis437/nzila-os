// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';

// Ensure React is globally available for JSX classic transform
globalThis.React = React;

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

import { FeatureFlagProvider, useFeatureFlag } from '../../hooks/use-feature-flags';

function makeWrapper(initialFlags?: Record<string, boolean>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(FeatureFlagProvider, { initialFlags }, children);
  };
}

describe('use-feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ flags: { dark_mode: true, beta_ui: false } }),
    });
    globalThis.fetch = mocks.mockFetch as unknown as typeof fetch;
  });

  describe('useFeatureFlag', () => {
    it('returns false when used outside FeatureFlagProvider', () => {
      const { result } = renderHook(() => useFeatureFlag('anything'));
      expect(result.current).toBe(false);
    });

    it('returns true for an enabled flag after fetch', async () => {
      const { result } = renderHook(() => useFeatureFlag('dark_mode'), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it('returns false for a disabled flag', async () => {
      const { result } = renderHook(() => useFeatureFlag('beta_ui'), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current).toBe(false));
    });

    it('returns false for an unknown flag', async () => {
      const { result } = renderHook(() => useFeatureFlag('nonexistent'), {
        wrapper: makeWrapper(),
      });

      // After fetch completes, still false
      await waitFor(() => {
        expect(mocks.mockFetch).toHaveBeenCalled();
      });
      expect(result.current).toBe(false);
    });

    it('uses initialFlags before fetch completes', () => {
      const { result } = renderHook(() => useFeatureFlag('pre_loaded'), {
        wrapper: makeWrapper({ pre_loaded: true }),
      });

      // Before fetch resolves, should use initial flags
      expect(result.current).toBe(true);
    });

    it('handles fetch failure gracefully', async () => {
      mocks.mockFetch.mockResolvedValue({ ok: false });

      const { result } = renderHook(() => useFeatureFlag('dark_mode'), {
        wrapper: makeWrapper({ dark_mode: true }),
      });

      // Should keep initial flags on failure
      await waitFor(() => expect(mocks.mockFetch).toHaveBeenCalled());
      expect(result.current).toBe(true);
    });
  });
});
