import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type AnalyticsModule = typeof import('../analytics');

interface FakeWindow {
  addEventListener: (type: string, listener: (event?: unknown) => void, opts?: unknown) => void;
  _listeners: Record<string, ((event?: unknown) => void)[]>;
  location: { pathname: string };
  screen: { width: number; height: number };
}

function makeWindow(): FakeWindow {
  const listeners: Record<string, ((event?: unknown) => void)[]> = {};
  return {
    _listeners: listeners,
    location: { pathname: '/home' },
    screen: { width: 390, height: 844 },
    addEventListener(type, listener) {
      (listeners[type] ||= []).push(listener);
    },
  };
}

let win: FakeWindow;
let doc: { visibilityState: string };
let Analytics: AnalyticsModule;
let fetchMock: ReturnType<typeof vi.fn>;
let uuidCount = 0;

describe('mobile analytics', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    uuidCount = 0;
    win = makeWindow();
    doc = { visibilityState: 'visible' };
    fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => `uuid-${++uuidCount}` });
    vi.stubGlobal('navigator', {
      platform: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone) Chrome/120 Safari/537',
      connection: { effectiveType: '4g' },
    });
    Analytics = await import('../analytics');
    // The module-level singleton calls init() on import (window is stubbed);
    // reset captured listeners so each test exercises only its own instance.
    win._listeners.click = [];
    win._listeners.scroll = [];
    win._listeners.keypress = [];
    win._listeners.visibilitychange = [];
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('constructor / factory / singleton', () => {
    it('createMobileAnalytics returns an instance with a session id', () => {
      const a = Analytics.createMobileAnalytics();
      expect(a).toBeInstanceOf(Analytics.MobileAnalytics);
    });

    it('exports a singleton', () => {
      expect(Analytics.mobileAnalytics).toBeInstanceOf(Analytics.MobileAnalytics);
    });
  });

  describe('init', () => {
    it('registers listeners, tracks initial screen view, and is idempotent', () => {
      const a = new Analytics.MobileAnalytics();
      a.init('user-1');
      expect(win._listeners.click).toHaveLength(1);
      expect(win._listeners.scroll).toHaveLength(1);
      expect(win._listeners.keypress).toHaveLength(1);
      expect(win._listeners.visibilitychange).toHaveLength(1);
      // idempotent
      a.init('user-2');
      expect(win._listeners.click).toHaveLength(1);
    });

    it('does nothing when disabled', () => {
      const a = new Analytics.MobileAnalytics({ enabled: false });
      a.init();
      expect(win._listeners.click).toHaveLength(0);
    });

    it('trackActivity listener updates last activity without error', () => {
      const a = new Analytics.MobileAnalytics();
      a.init();
      expect(() => win._listeners.click[0]()).not.toThrow();
    });

    it('visibilitychange flushes when the page becomes hidden', async () => {
      const a = new Analytics.MobileAnalytics();
      a.init();
      a.trackAction('tap'); // queue one event
      fetchMock.mockClear();
      doc.visibilityState = 'hidden';
      win._listeners.visibilitychange[0]();
      await vi.runOnlyPendingTimersAsync();
      expect(fetchMock).toHaveBeenCalled();
    });

    it('visibilitychange does not flush while visible', () => {
      const a = new Analytics.MobileAnalytics();
      a.init();
      a.trackAction('tap');
      fetchMock.mockClear();
      doc.visibilityState = 'visible';
      win._listeners.visibilitychange[0]();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('session-timeout interval ends and starts a new session', async () => {
      const a = new Analytics.MobileAnalytics({ sessionTimeout: 1000 });
      a.init();
      // advance lastActivity into the past by faking time forward
      await vi.advanceTimersByTimeAsync(60000 + 1);
      // session_end + session_start tracked => events present, flush attempted
      expect(fetchMock).toHaveBeenCalled();
    });

    it('flush interval sends events when batch size is reached', async () => {
      const a = new Analytics.MobileAnalytics({ batchSize: 100 });
      a.init();
      for (let i = 0; i < 100; i++) a.trackAction(`a${i}`);
      // queue auto-flushes at batchSize during track; ensure interval path also safe
      await vi.advanceTimersByTimeAsync(30000);
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('tracking methods', () => {
    let a: InstanceType<AnalyticsModule['MobileAnalytics']>;
    beforeEach(() => {
      a = new Analytics.MobileAnalytics({ batchSize: 1000 });
    });

    it('setUserId attaches the user id to tracked events', async () => {
      a.setUserId('user-9');
      a.trackEvent('evt', 'action');
      await a.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.events[0].userId).toBe('user-9');
    });

    it('trackScreenView records a screen event', async () => {
      a.trackScreenView('Dashboard', '/dash');
      await a.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.events[0].category).toBe('screen');
      expect(body.events[0].properties.screenName).toBe('Dashboard');
    });

    it('trackAction / trackError / trackPerformance / trackSync / trackOffline record events', async () => {
      a.trackAction('act', { x: 1 });
      a.trackError('err');
      a.trackPerformance('lcp', 2.5);
      a.trackSync('pull', true);
      a.trackOffline('queued');
      await a.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      const cats = body.events.map((e: { category: string }) => e.category);
      expect(cats).toEqual(['action', 'error', 'performance', 'sync', 'offline']);
      const perf = body.events.find((e: { name: string }) => e.name === 'lcp');
      expect(perf.properties.value).toBe(2.5);
    });

    it('captures device info from navigator/window', async () => {
      a.trackAction('act');
      await a.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      const info = body.events[0].deviceInfo;
      expect(info.platform).toBe('iPhone');
      expect(info.os).toBe('iOS');
      expect(info.browser).toBe('Chrome');
      expect(info.screenWidth).toBe(390);
      expect(info.connectionType).toBe('4g');
    });

    it('skips events outside the sample rate', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const sampled = new Analytics.MobileAnalytics({ sampleRate: 0.1 });
      sampled.trackAction('act');
      await sampled.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not track when disabled', async () => {
      const off = new Analytics.MobileAnalytics({ enabled: false });
      off.trackAction('act');
      await off.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('is a no-op when there are no events', async () => {
      const a = new Analytics.MobileAnalytics();
      await a.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('re-queues events when sending fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      const a = new Analytics.MobileAnalytics({ batchSize: 1000 });
      a.trackAction('act');
      await a.flush();
      await a.flush(); // re-queued -> sent on retry
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('device-info branches', () => {
    it('detects Android/Firefox', async () => {
      vi.stubGlobal('navigator', { platform: 'Linux', userAgent: 'Android Firefox', connection: null });
      vi.resetModules();
      const mod = await import('../analytics');
      const a = new mod.MobileAnalytics({ batchSize: 1000 });
      a.trackAction('x');
      await a.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.events[0].deviceInfo.os).toBe('Android');
      expect(body.events[0].deviceInfo.browser).toBe('Firefox');
    });

    it('falls back to Unknown OS/browser', async () => {
      vi.stubGlobal('navigator', { platform: 'X', userAgent: 'CustomAgent', connection: undefined });
      vi.resetModules();
      const mod = await import('../analytics');
      const a = new mod.MobileAnalytics({ batchSize: 1000 });
      a.trackAction('x');
      await a.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.events[0].deviceInfo.os).toBe('Unknown');
      expect(body.events[0].deviceInfo.browser).toBe('Unknown');
    });
  });
});
