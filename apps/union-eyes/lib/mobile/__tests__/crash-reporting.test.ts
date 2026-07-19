import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type CrashModule = typeof import('../crash-reporting');

class FakeHTMLElement { tagName = 'DIV'; }
class FakeHTMLScriptElement extends FakeHTMLElement { constructor() { super(); this.tagName = 'SCRIPT'; } }
class FakeHTMLLinkElement extends FakeHTMLElement { constructor() { super(); this.tagName = 'LINK'; } }
class FakeHTMLImageElement extends FakeHTMLElement { constructor() { super(); this.tagName = 'IMG'; } }

interface FakeWindow {
  onerror: ((...args: unknown[]) => void) | null;
  onunhandledrejection: ((event: unknown) => void) | null;
  addEventListener: (type: string, listener: (event: unknown) => void, capture?: boolean) => void;
  location: { href: string };
  _listeners: Record<string, ((event: unknown) => void)[]>;
}

function makeWindow(): FakeWindow {
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  return {
    onerror: null,
    onunhandledrejection: null,
    location: { href: 'https://app.test/page' },
    _listeners: listeners,
    addEventListener(type, listener) {
      (listeners[type] ||= []).push(listener);
    },
  };
}

let win: FakeWindow;
let Crash: CrashModule;
let fetchMock: ReturnType<typeof vi.fn>;

describe('crash-reporting', () => {
  beforeEach(async () => {
    vi.resetModules();
    win = makeWindow();
    fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('window', win);
    vi.stubGlobal('navigator', { userAgent: 'jest-agent' });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    vi.stubGlobal('HTMLScriptElement', FakeHTMLScriptElement);
    vi.stubGlobal('HTMLLinkElement', FakeHTMLLinkElement);
    vi.stubGlobal('HTMLImageElement', FakeHTMLImageElement);
    vi.spyOn(Math, 'random').mockReturnValue(0); // always within sample rate
    Crash = await import('../crash-reporting');
    // The module-level singleton calls init() on import; reset captured state so
    // each test exercises only its own reporter instance.
    win.onerror = null;
    win.onunhandledrejection = null;
    win._listeners.error = [];
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('CrashReporter.init', () => {
    it('registers global handlers and is idempotent', () => {
      const r = new Crash.CrashReporter();
      r.init();
      expect(typeof win.onerror).toBe('function');
      expect(typeof win.onunhandledrejection).toBe('function');
      expect(win._listeners.error).toHaveLength(1);
      // Second init returns early (no new error listener)
      r.init();
      expect(win._listeners.error).toHaveLength(1);
    });

    it('does nothing when disabled', () => {
      win.onerror = null;
      const r = new Crash.CrashReporter({ enabled: false });
      r.init();
      expect(win.onerror).toBeNull();
    });
  });

  describe('global error handlers', () => {
    it('onerror handler reports an uncaught exception (with stack)', () => {
      const r = new Crash.CrashReporter();
      r.init();
      win.onerror!('boom', 'app.js', 10, 5, new Error('boom'));
      r.init(); // no-op
      // queue should hold the report; flushing sends it
      return r.flush().then(() => {
        expect(fetchMock).toHaveBeenCalledOnce();
        const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
        expect(body.reports[0].type).toBe('uncaught_exception');
        expect(body.reports[0].stack).toBeDefined();
      });
    });

    it('onunhandledrejection handler reports with reason message', async () => {
      const r = new Crash.CrashReporter();
      r.init();
      win.onunhandledrejection!({ reason: new Error('rejected') });
      await r.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.reports[0].type).toBe('unhandled_promise_rejection');
      expect(body.reports[0].message).toBe('rejected');
    });

    it('onunhandledrejection handles a non-error reason', async () => {
      const r = new Crash.CrashReporter();
      r.init();
      win.onunhandledrejection!({ reason: 'plain-string' });
      await r.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.reports[0].message).toBe('plain-string');
    });

    it('resource error listener reports for script/link/image targets', async () => {
      const r = new Crash.CrashReporter();
      r.init();
      win._listeners.error[0]({ target: new FakeHTMLScriptElement() });
      await r.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.reports[0].type).toBe('resource_error');
      expect(body.reports[0].message).toContain('SCRIPT');
    });

    it('resource error listener ignores non-resource targets', async () => {
      const r = new Crash.CrashReporter();
      r.init();
      win._listeners.error[0]({ target: new FakeHTMLElement() });
      await r.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('reportError / flush', () => {
    it('skips reports outside the sample rate', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.9);
      const r = new Crash.CrashReporter({ sampleRate: 0.5 });
      r.reportError({ type: 'manual', message: 'm', timestamp: 't', userAgent: 'u', url: 'x' });
      await r.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('auto-flushes when the queue reaches maxQueueSize', async () => {
      const r = new Crash.CrashReporter({ maxQueueSize: 2 });
      r.reportError({ type: 'manual', message: 'a', timestamp: 't', userAgent: 'u', url: 'x' });
      r.reportError({ type: 'manual', message: 'b', timestamp: 't', userAgent: 'u', url: 'x' });
      await Promise.resolve();
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('flush is a no-op when the queue is empty', async () => {
      const r = new Crash.CrashReporter();
      await r.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('re-queues reports when sending fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network'));
      const r = new Crash.CrashReporter({ maxQueueSize: 1000 });
      r.reportError({ type: 'manual', message: 'a', timestamp: 't', userAgent: 'u', url: 'x' });
      await r.flush();
      // re-queued -> a successful flush now sends it
      await r.flush();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('assigns a generated id to each report', async () => {
      const r = new Crash.CrashReporter();
      r.reportError({ type: 'manual', message: 'a', timestamp: 't', userAgent: 'u', url: 'x' });
      await r.flush();
      const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
      expect(body.reports[0].id).toMatch(/^\d+-/);
    });
  });

  describe('factory and singleton', () => {
    it('createCrashReporter returns an initialized reporter', () => {
      const r = Crash.createCrashReporter({ endpoint: '/custom' });
      expect(r).toBeInstanceOf(Crash.CrashReporter);
      expect(typeof win.onerror).toBe('function');
    });

    it('exports a singleton crashReporter', () => {
      expect(Crash.crashReporter).toBeInstanceOf(Crash.CrashReporter);
    });
  });
});
