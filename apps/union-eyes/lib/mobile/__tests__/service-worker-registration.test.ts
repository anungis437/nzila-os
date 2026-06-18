// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  useServiceWorker,
  usePWAInstall,
  useNetworkStatus,
  useDeviceInfo,
} from '../service-worker-registration';

type Listener = (event?: unknown) => void;

function makeEmitter() {
  const listeners: Record<string, Listener[]> = {};
  return {
    listeners,
    addEventListener: (type: string, fn: Listener) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: (type: string, fn: Listener) => {
      listeners[type] = (listeners[type] || []).filter(l => l !== fn);
    },
    emit: (type: string, event?: unknown) => { (listeners[type] || []).forEach(l => l(event)); },
  };
}

let standaloneMatches: boolean;

function setMatchMedia() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('standalone') ? standaloneMatches : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('service-worker-registration hooks', () => {
  beforeEach(() => {
    standaloneMatches = false;
    setMatchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('useServiceWorker', () => {
    it('reports unsupported when serviceWorker is missing', async () => {
      vi.stubGlobal('navigator', { userAgent: 'x' });
      const { result } = renderHook(() => useServiceWorker());
      await waitFor(() => expect(result.current.isSupported).toBe(false));
    });

    it('registers the worker and becomes ready, surfacing updates', async () => {
      const newWorker = { ...makeEmitter(), state: 'installed' };
      const regEmitter = makeEmitter();
      const registration = { ...regEmitter, installing: newWorker };
      const swRegister = vi.fn(async () => registration);
      vi.stubGlobal('navigator', {
        serviceWorker: { register: swRegister, ready: Promise.resolve(registration), controller: {} },
        userAgent: 'x',
      });

      const { result } = renderHook(() => useServiceWorker());
      await waitFor(() => expect(result.current.isReady).toBe(true));
      expect(swRegister).toHaveBeenCalledWith('/service-worker.js', { scope: '/' });

      // Fire updatefound -> registers statechange -> fire statechange
      await act(async () => {
        regEmitter.emit('updatefound');
        newWorker.emit('statechange');
      });
      await waitFor(() => expect(result.current.updateAvailable).toBe(true));
      expect(result.current.waitingWorker).toBe(newWorker);
    });

    it('handles a registration failure', async () => {
      vi.stubGlobal('navigator', {
        serviceWorker: { register: vi.fn(async () => { throw new Error('fail'); }), ready: Promise.resolve({}) },
        userAgent: 'x',
      });
      const { result } = renderHook(() => useServiceWorker());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      expect(result.current.isReady).toBe(false);
    });
  });

  describe('usePWAInstall', () => {
    it('captures the install prompt and installs when accepted', async () => {
      vi.stubGlobal('navigator', { userAgent: 'x' });
      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.canInstall).toBe(false);

      const prompt = vi.fn(async () => undefined);
      const evt = Object.assign(new Event('beforeinstallprompt'), {
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
        preventDefault: vi.fn(),
      });
      await act(async () => { window.dispatchEvent(evt); });
      await waitFor(() => expect(result.current.canInstall).toBe(true));

      await act(async () => { await result.current.install(); });
      expect(prompt).toHaveBeenCalled();
      expect(result.current.canInstall).toBe(false);
    });

    it('install is a no-op without a deferred prompt', async () => {
      vi.stubGlobal('navigator', { userAgent: 'x' });
      const { result } = renderHook(() => usePWAInstall());
      await act(async () => { await result.current.install(); });
      expect(result.current.canInstall).toBe(false);
    });

    it('reports standalone mode', async () => {
      standaloneMatches = true;
      setMatchMedia();
      vi.stubGlobal('navigator', { userAgent: 'x' });
      const { result } = renderHook(() => usePWAInstall());
      expect(result.current.isStandalone).toBe(true);
      expect(result.current.isInstalled).toBe(true);
    });
  });

  describe('useNetworkStatus', () => {
    it('reflects online status and connection type', async () => {
      const connection = { effectiveType: '4g', addEventListener: vi.fn(), removeEventListener: vi.fn() };
      vi.stubGlobal('navigator', { onLine: true, connection, userAgent: 'x' });
      const { result } = renderHook(() => useNetworkStatus());
      await waitFor(() => expect(result.current.connectionType).toBe('4g'));
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isOffline).toBe(false);
      expect(connection.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('updates when offline/online events fire', async () => {
      const nav = { onLine: true, userAgent: 'x' } as { onLine: boolean; userAgent: string };
      vi.stubGlobal('navigator', nav);
      const { result } = renderHook(() => useNetworkStatus());
      await waitFor(() => expect(result.current.isOnline).toBe(true));
      nav.onLine = false;
      await act(async () => { window.dispatchEvent(new Event('offline')); });
      await waitFor(() => expect(result.current.isOffline).toBe(true));
    });
  });

  describe('useDeviceInfo', () => {
    it('detects a mobile iOS Safari device', async () => {
      vi.stubGlobal('navigator', { userAgent: 'iPhone Safari', onLine: true });
      Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true });
      const { result } = renderHook(() => useDeviceInfo());
      await waitFor(() => expect(result.current.os).toBe('iOS'));
      expect(result.current.isMobile).toBe(true);
      expect(result.current.browser).toBe('Safari');
      expect(result.current.pixelRatio).toBe(3);
    });

    it('detects a desktop Windows Chrome device', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Windows Chrome', onLine: true });
      const { result } = renderHook(() => useDeviceInfo());
      await waitFor(() => expect(result.current.os).toBe('Windows'));
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.browser).toBe('Chrome');
    });

    it('detects an Android tablet', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Android Firefox', onLine: true });
      const { result } = renderHook(() => useDeviceInfo());
      await waitFor(() => expect(result.current.os).toBe('Android'));
      expect(result.current.isTablet).toBe(true);
      expect(result.current.browser).toBe('Firefox');
    });
  });
});
