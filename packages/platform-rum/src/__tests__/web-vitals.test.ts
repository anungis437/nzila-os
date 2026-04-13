/**
 * Comprehensive tests for @nzila/platform-rum web-vitals module.
 *
 * Covers: initWebVitals, flushWebVitals, and internal helpers
 * (rateMetric, getDeviceInfo, metricToRUMEvent, flush, enqueue)
 * via the exported API surface.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const wvMocks = vi.hoisted(() => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onINP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
}));

vi.mock('web-vitals', () => wvMocks);

// ── Module under test (must import AFTER vi.mock) ───────────────────────────

import { initWebVitals, flushWebVitals } from '../web-vitals';
import type { RUMReporterOptions } from '../types';

// ── Globals setup ───────────────────────────────────────────────────────────

describe('web-vitals', () => {
  let sendBeaconSpy: ReturnType<typeof vi.fn>;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let addEventListenerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    sendBeaconSpy = vi.fn().mockReturnValue(true);
    fetchSpy = vi.fn().mockResolvedValue(new Response());
    addEventListenerSpy = vi.fn();

    // Simulate browser environment
    vi.stubGlobal('window', { location: { pathname: '/test-page' } });
    vi.stubGlobal('navigator', {
      sendBeacon: sendBeaconSpy,
      userAgent: 'test-ua',
      connection: { effectiveType: '4g' },
      deviceMemory: 8,
    });
    vi.stubGlobal('document', {
      addEventListener: addEventListenerSpy,
      visibilityState: 'visible',
    });
    vi.stubGlobal('fetch', fetchSpy);

    // Flush any leftover state from previous tests
    flushWebVitals('/flush-cleanup');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── initWebVitals ─────────────────────────────────────────────────────

  describe('initWebVitals', () => {
    it('returns early in SSR (no window)', async () => {
      vi.stubGlobal('window', undefined);

      const opts: RUMReporterOptions = { appName: 'web' };
      await initWebVitals(opts);

      // None of the web-vitals handlers should be registered
      expect(wvMocks.onCLS).not.toHaveBeenCalled();
    });

    it('respects sample rate = 0 (never sample)', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      await initWebVitals({ appName: 'web', sampleRate: 0 });

      // Math.random() = 0.5 > sampleRate 0 → sampled out
      expect(wvMocks.onCLS).not.toHaveBeenCalled();
    });

    it('registers all 5 web vital handlers', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // always sampled in

      await initWebVitals({ appName: 'web', sampleRate: 1.0 });

      expect(wvMocks.onCLS).toHaveBeenCalledOnce();
      expect(wvMocks.onFCP).toHaveBeenCalledOnce();
      expect(wvMocks.onINP).toHaveBeenCalledOnce();
      expect(wvMocks.onLCP).toHaveBeenCalledOnce();
      expect(wvMocks.onTTFB).toHaveBeenCalledOnce();
    });

    it('registers visibilitychange listener', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await initWebVitals({ appName: 'web' });

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function),
      );
    });

    it('uses default config values when not specified', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);

      await initWebVitals({ appName: 'web' });

      // Defaults: endpoint='/api/rum', batchSize=10, flushIntervalMs=5000
      // Can verify by sending events and checking flush behavior
      expect(wvMocks.onCLS).toHaveBeenCalled(); // setup succeeded
    });
  });

  // ── Metric handling (rateMetric, metricToRUMEvent, enqueue) ───────────

  describe('metric handling via handlers', () => {
    async function setupAndGetHandler(opts?: Partial<RUMReporterOptions>) {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await initWebVitals({
        appName: 'test-app',
        endpoint: '/api/rum',
        batchSize: 3,
        flushIntervalMs: 5000,
        ...opts,
      });
      // Return the CLS handler for testing
      return wvMocks.onCLS.mock.calls[0]?.[0] as (metric: unknown) => void;
    }

    it('buffers events until batchSize is reached then flushes via sendBeacon', async () => {
      const handler = await setupAndGetHandler({ batchSize: 2 });

      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'm1', navigationType: 'navigate' });
      expect(sendBeaconSpy).not.toHaveBeenCalled();

      handler({ name: 'CLS', value: 0.1, delta: 0.05, id: 'm2', navigationType: 'navigate' });
      expect(sendBeaconSpy).toHaveBeenCalledOnce();

      const payload = JSON.parse(sendBeaconSpy.mock.calls[0][1]);
      expect(payload).toHaveLength(2);
    });

    it('flushes via timer when batchSize not reached', async () => {
      const handler = await setupAndGetHandler({ batchSize: 10, flushIntervalMs: 3000 });

      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'm1', navigationType: 'navigate' });
      expect(sendBeaconSpy).not.toHaveBeenCalled();

      // Advance timer
      vi.advanceTimersByTime(3000);
      expect(sendBeaconSpy).toHaveBeenCalledOnce();
    });

    it('creates RUMEvent with correct fields', async () => {
      const handler = await setupAndGetHandler({ batchSize: 1 });

      handler({ name: 'CLS', value: 0.05, delta: 0.02, id: 'metric-1', navigationType: 'navigate' });

      const payload = JSON.parse(sendBeaconSpy.mock.calls[0][1]);
      const event = payload[0];

      expect(event.metric.name).toBe('CLS');
      expect(event.metric.value).toBe(0.05);
      expect(event.metric.delta).toBe(0.02);
      expect(event.metric.id).toBe('metric-1');
      expect(event.metric.navigationType).toBe('navigate');
      expect(event.pathname).toBe('/test-page');
      expect(event.userAgent).toBe('test-ua');
      expect(event.connectionType).toBe('4g');
      expect(event.deviceMemory).toBe(8);
      expect(event.appName).toBe('test-app');
      expect(event.timestamp).toBeDefined();
    });

    it('rates CLS as good / needs-improvement / poor', async () => {
      const handler = await setupAndGetHandler({ batchSize: 1 });

      // CLS thresholds: good <= 0.1, poor > 0.25
      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'c1', navigationType: 'n' });
      let event = JSON.parse(sendBeaconSpy.mock.calls[0][1])[0];
      expect(event.metric.rating).toBe('good');

      handler({ name: 'CLS', value: 0.15, delta: 0.15, id: 'c2', navigationType: 'n' });
      event = JSON.parse(sendBeaconSpy.mock.calls[1][1])[0];
      expect(event.metric.rating).toBe('needs-improvement');

      handler({ name: 'CLS', value: 0.5, delta: 0.5, id: 'c3', navigationType: 'n' });
      event = JSON.parse(sendBeaconSpy.mock.calls[2][1])[0];
      expect(event.metric.rating).toBe('poor');
    });

    it('rates LCP correctly', async () => {
      const lcpHandler = await setupAndGetHandler({ batchSize: 1 });
      // Use LCP handler via the setup
      const handler = wvMocks.onLCP.mock.calls[0]?.[0] as (m: unknown) => void;

      // LCP thresholds: good <= 2500, poor > 4000
      handler({ name: 'LCP', value: 2000, delta: 2000, id: 'l1', navigationType: 'n' });
      let event = JSON.parse(sendBeaconSpy.mock.calls[0][1])[0];
      expect(event.metric.rating).toBe('good');

      handler({ name: 'LCP', value: 3500, delta: 3500, id: 'l2', navigationType: 'n' });
      event = JSON.parse(sendBeaconSpy.mock.calls[1][1])[0];
      expect(event.metric.rating).toBe('needs-improvement');

      handler({ name: 'LCP', value: 5000, delta: 5000, id: 'l3', navigationType: 'n' });
      event = JSON.parse(sendBeaconSpy.mock.calls[2][1])[0];
      expect(event.metric.rating).toBe('poor');
    });

    it('excludes device info when includeDeviceInfo is false', async () => {
      const handler = await setupAndGetHandler({ batchSize: 1, includeDeviceInfo: false });

      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'c1', navigationType: 'n' });

      const event = JSON.parse(sendBeaconSpy.mock.calls[0][1])[0];
      expect(event.connectionType).toBeUndefined();
      expect(event.deviceMemory).toBeUndefined();
    });

    it('handles navigator without connection info', async () => {
      vi.stubGlobal('navigator', {
        sendBeacon: sendBeaconSpy,
        userAgent: 'no-connection-ua',
        // no connection, no deviceMemory
      });

      const handler = await setupAndGetHandler({ batchSize: 1 });
      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'c1', navigationType: 'n' });

      const event = JSON.parse(sendBeaconSpy.mock.calls[0][1])[0];
      expect(event.connectionType).toBeUndefined();
      expect(event.deviceMemory).toBeUndefined();
    });
  });

  // ── flush behavior ────────────────────────────────────────────────────

  describe('flush', () => {
    it('falls back to fetch when sendBeacon is unavailable', async () => {
      vi.stubGlobal('navigator', {
        userAgent: 'no-beacon',
        // no sendBeacon
      });

      vi.spyOn(Math, 'random').mockReturnValue(0);
      await initWebVitals({ appName: 'web', batchSize: 1, endpoint: '/rum' });

      const handler = wvMocks.onCLS.mock.calls[0][0] as (m: unknown) => void;
      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'f1', navigationType: 'n' });

      expect(fetchSpy).toHaveBeenCalledWith('/rum', expect.objectContaining({
        method: 'POST',
        keepalive: true,
      }));
    });

    it('swallows fetch errors', async () => {
      vi.stubGlobal('navigator', { userAgent: 'x' });
      fetchSpy.mockRejectedValueOnce(new Error('network'));

      vi.spyOn(Math, 'random').mockReturnValue(0);
      await initWebVitals({ appName: 'web', batchSize: 1, endpoint: '/rum' });

      const handler = wvMocks.onCLS.mock.calls[0][0] as (m: unknown) => void;

      // Should not throw
      expect(() => handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'f1', navigationType: 'n' })).not.toThrow();
    });

    it('does not send when buffer is empty', () => {
      flushWebVitals('/api/rum');
      expect(sendBeaconSpy).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('visibilitychange hidden triggers flush', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await initWebVitals({ appName: 'web', batchSize: 100, endpoint: '/rum' });

      const handler = wvMocks.onCLS.mock.calls[0][0] as (m: unknown) => void;
      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'v1', navigationType: 'n' });

      // Get the visibilitychange callback
      const visCallback = addEventListenerSpy.mock.calls.find(
        (c: unknown[]) => c[0] === 'visibilitychange',
      )?.[1] as () => void;

      // Simulate page hidden
      vi.stubGlobal('document', { ...document, visibilityState: 'hidden' });
      // Actually the listener checks document.visibilityState at call time
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      visCallback();

      expect(sendBeaconSpy).toHaveBeenCalled();
    });
  });

  // ── flushWebVitals ────────────────────────────────────────────────────

  describe('flushWebVitals', () => {
    it('flushes buffered events', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      await initWebVitals({ appName: 'web', batchSize: 100, endpoint: '/rum' });

      const handler = wvMocks.onCLS.mock.calls[0][0] as (m: unknown) => void;
      handler({ name: 'CLS', value: 0.05, delta: 0.05, id: 'fl1', navigationType: 'n' });

      flushWebVitals('/rum');

      expect(sendBeaconSpy).toHaveBeenCalledOnce();
    });

    it('uses default endpoint', () => {
      // Empty buffer — no-op, but covers the default parameter
      flushWebVitals();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });
  });
});
