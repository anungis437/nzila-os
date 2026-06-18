// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Ensure React is globally available for JSX classic transform
globalThis.React = React;

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

import {
  FeatureFlagProvider,
  FeatureGate,
  MultiFeatureGate,
  useAllFeatureFlags,
  useFeatureFlag,
  useFeatureFlags,
} from '../../hooks/use-feature-flags';

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
    globalThis.fetch = mocks.mockFetch as any as typeof fetch;
  });

  afterEach(() => {
    cleanup();
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

    it('keeps initial flags when fetch throws (catch branch)', async () => {
      mocks.mockFetch.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useFeatureFlag('dark_mode'), {
        wrapper: makeWrapper({ dark_mode: true }),
      });

      await waitFor(() => expect(mocks.mockFetch).toHaveBeenCalled());
      expect(result.current).toBe(true);
    });
  });

  describe('useFeatureFlags (plural)', () => {
    it('returns all false when used outside the provider', () => {
      const { result } = renderHook(() => useFeatureFlags(['a', 'b']));
      expect(result.current).toEqual({ a: false, b: false });
    });

    it('maps each requested flag to its context value', async () => {
      const { result } = renderHook(() => useFeatureFlags(['dark_mode', 'beta_ui', 'missing']), {
        wrapper: makeWrapper(),
      });

      await waitFor(() => expect(result.current.dark_mode).toBe(true));
      expect(result.current).toEqual({ dark_mode: true, beta_ui: false, missing: false });
    });
  });

  describe('useAllFeatureFlags', () => {
    it('throws when used outside the provider', () => {
      expect(() => renderHook(() => useAllFeatureFlags())).toThrow(
        /must be used within FeatureFlagProvider/,
      );
    });

    it('returns the full context value inside the provider', async () => {
      const { result } = renderHook(() => useAllFeatureFlags(), { wrapper: makeWrapper() });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.flags.dark_mode).toBe(true);
      expect(typeof result.current.refresh).toBe('function');
    });
  });

  describe('FeatureGate', () => {
    it('renders children when the feature is enabled', async () => {
      render(
        React.createElement(
          FeatureFlagProvider,
          null,
          React.createElement(FeatureGate, { feature: 'dark_mode' }, 'gated-content'),
        ),
      );
      await waitFor(() => expect(screen.getByText('gated-content')).toBeTruthy());
    });

    it('renders the fallback when the feature is disabled', async () => {
      render(
        React.createElement(
          FeatureFlagProvider,
          null,
          React.createElement(
            FeatureGate,
            { feature: 'beta_ui', fallback: 'fallback-content' },
            'gated-content',
          ),
        ),
      );
      await waitFor(() => expect(screen.getByText('fallback-content')).toBeTruthy());
      expect(screen.queryByText('gated-content')).toBeNull();
    });
  });

  describe('MultiFeatureGate', () => {
    it('renders when all features are enabled (requireAll, every callback)', async () => {
      render(
        React.createElement(
          FeatureFlagProvider,
          null,
          React.createElement(
            MultiFeatureGate,
            { features: ['dark_mode'] },
            'all-enabled',
          ),
        ),
      );
      await waitFor(() => expect(screen.getByText('all-enabled')).toBeTruthy());
    });

    it('renders the fallback when requireAll and a feature is disabled', async () => {
      render(
        React.createElement(
          FeatureFlagProvider,
          null,
          React.createElement(
            MultiFeatureGate,
            { features: ['dark_mode', 'beta_ui'], fallback: 'multi-fallback' },
            'all-enabled',
          ),
        ),
      );
      await waitFor(() => expect(screen.getByText('multi-fallback')).toBeTruthy());
    });

    it('renders when ANY feature is enabled (requireAll=false, some callback)', async () => {
      render(
        React.createElement(
          FeatureFlagProvider,
          null,
          React.createElement(
            MultiFeatureGate,
            { features: ['beta_ui', 'dark_mode'], requireAll: false },
            'any-enabled',
          ),
        ),
      );
      await waitFor(() => expect(screen.getByText('any-enabled')).toBeTruthy());
    });
  });
});
