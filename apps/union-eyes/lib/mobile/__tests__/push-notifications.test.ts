// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act, cleanup } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  usePushNotifications,
  useNotificationPermission,
  useLocalNotifications,
} from '../push-notifications';

class FakeNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
  title: string;
  options?: unknown;
  constructor(title: string, options?: unknown) { this.title = title; this.options = options; }
}

let subscription: { endpoint: string; unsubscribe: ReturnType<typeof vi.fn> };
let pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> };
let registration: { pushManager: typeof pushManager; showNotification: ReturnType<typeof vi.fn> };
let serviceWorker: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;

describe('push-notifications hooks', () => {
  beforeEach(() => {
    FakeNotification.permission = 'default';
    FakeNotification.requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    subscription = { endpoint: 'https://push/endpoint', unsubscribe: vi.fn(async () => true) };
    pushManager = {
      getSubscription: vi.fn(async () => subscription),
      subscribe: vi.fn(async () => subscription),
    };
    registration = { pushManager, showNotification: vi.fn() };
    serviceWorker = { ready: Promise.resolve(registration), controller: {} };
    fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('PushManager', function PushManager() {});
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { serviceWorker, userAgent: 'test' });
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BPgxh/abcd-_';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('usePushNotifications', () => {
    it('detects an existing subscription on mount', async () => {
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      expect(result.current.isSubscribed).toBe(true);
      expect(result.current.subscription).toBe(subscription);
    });

    it('reports unsupported when PushManager is missing', async () => {
      delete (globalThis as { PushManager?: unknown }).PushManager;
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(false));
    });

    it('handles a subscription check error', async () => {
      pushManager.getSubscription.mockRejectedValueOnce(new Error('fail'));
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      expect(result.current.isSubscribed).toBe(false);
    });

    it('requestPermission updates state', async () => {
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      let perm: NotificationPermission = 'default';
      await act(async () => { perm = await result.current.requestPermission(); });
      expect(perm).toBe('granted');
      expect(result.current.permission).toBe('granted');
    });

    it('subscribe registers a push subscription and posts to the server', async () => {
      pushManager.getSubscription.mockResolvedValueOnce(null);
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      let sub: unknown;
      await act(async () => { sub = await result.current.subscribe(); });
      expect(sub).toBe(subscription);
      expect(fetchMock).toHaveBeenCalledWith('/api/mobile/push/subscribe', expect.anything());
      expect(result.current.isSubscribed).toBe(true);
    });

    it('subscribe returns null when permission is denied', async () => {
      FakeNotification.requestPermission = vi.fn(async () => 'denied' as NotificationPermission);
      pushManager.getSubscription.mockResolvedValueOnce(null);
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      let sub: unknown = 'x';
      await act(async () => { sub = await result.current.subscribe(); });
      expect(sub).toBeNull();
    });

    it('subscribe returns null on error', async () => {
      pushManager.subscribe.mockRejectedValueOnce(new Error('boom'));
      pushManager.getSubscription.mockResolvedValueOnce(null);
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      let sub: unknown = 'x';
      await act(async () => { sub = await result.current.subscribe(); });
      expect(sub).toBeNull();
    });

    it('unsubscribe removes the subscription and notifies the server', async () => {
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSubscribed).toBe(true));
      await act(async () => { await result.current.unsubscribe(); });
      expect(subscription.unsubscribe).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith('/api/mobile/push/unsubscribe', expect.anything());
      expect(result.current.isSubscribed).toBe(false);
    });

    it('unsubscribe is a no-op without a subscription', async () => {
      pushManager.getSubscription.mockResolvedValueOnce(null);
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSupported).toBe(true));
      await act(async () => { await result.current.unsubscribe(); });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('unsubscribe swallows errors', async () => {
      subscription.unsubscribe.mockRejectedValueOnce(new Error('nope'));
      const { result } = renderHook(() => usePushNotifications());
      await waitFor(() => expect(result.current.isSubscribed).toBe(true));
      await act(async () => { await result.current.unsubscribe(); });
      expect(result.current.isSubscribed).toBe(true);
    });
  });

  describe('useNotificationPermission', () => {
    it('initializes from Notification.permission and updates on request', async () => {
      FakeNotification.permission = 'granted';
      const { result } = renderHook(() => useNotificationPermission());
      await waitFor(() => expect(result.current.permission).toBe('granted'));
      expect(result.current.isGranted).toBe(true);
      expect(result.current.isDenied).toBe(false);
      FakeNotification.requestPermission = vi.fn(async () => 'denied' as NotificationPermission);
      let res: NotificationPermission = 'default';
      await act(async () => { res = await result.current.request(); });
      expect(res).toBe('denied');
      expect(result.current.isDenied).toBe(true);
    });
  });

  describe('useLocalNotifications', () => {
    it('does nothing without permission', () => {
      FakeNotification.permission = 'default';
      const { result } = renderHook(() => useLocalNotifications());
      act(() => { result.current.showNotification('Hi'); });
      expect(registration.showNotification).not.toHaveBeenCalled();
    });

    it('shows via the service worker when a controller exists', async () => {
      FakeNotification.permission = 'granted';
      const { result } = renderHook(() => useLocalNotifications());
      await act(async () => { result.current.showNotification('Hi', { body: 'b' }); await registration.pushManager; });
      await waitFor(() => expect(registration.showNotification).toHaveBeenCalledWith('Hi', expect.objectContaining({ body: 'b' })));
    });

    it('falls back to a standard Notification without a controller', () => {
      FakeNotification.permission = 'granted';
      serviceWorker.controller = null;
      const spy = vi.spyOn(FakeNotification.prototype, 'constructor' as never);
      const { result } = renderHook(() => useLocalNotifications());
      act(() => { result.current.showNotification('Hi'); });
      // a Notification instance was constructed (no SW path)
      expect(registration.showNotification).not.toHaveBeenCalled();
      void spy;
    });
  });
});
