/**
 * Platform RUM — Web Vitals Collector
 *
 * Collects Core Web Vitals using the `web-vitals` library and
 * normalizes them into RUMEvent records for reporting.
 *
 * Usage (in a Next.js app):
 * ```tsx
 * // app/layout.tsx or a client component
 * 'use client';
 * import { initWebVitals } from '@nzila/platform-rum/web-vitals';
 *
 * initWebVitals({ appName: 'web', endpoint: '/api/rum' });
 * ```
 */

import type { Metric } from 'web-vitals';
import type { RUMEvent, WebVitalName, RUMReporterOptions } from './types.js';
import { WEB_VITAL_THRESHOLDS } from './types.js';

type NavigatorWithDeviceInfo = Navigator & {
  connection?: { effectiveType?: string };
  deviceMemory?: number;
};

function rateMetric(name: WebVitalName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITAL_THRESHOLDS[name];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

function getDeviceInfo(): { connectionType?: string; deviceMemory?: number } {
  const info: { connectionType?: string; deviceMemory?: number } = {};
  if (typeof navigator !== 'undefined') {
    const nav = navigator as NavigatorWithDeviceInfo;
    if (nav.connection?.effectiveType) {
      info.connectionType = nav.connection.effectiveType;
    }
    if (nav.deviceMemory) {
      info.deviceMemory = nav.deviceMemory;
    }
  }
  return info;
}

function metricToRUMEvent(metric: Metric, options: RUMReporterOptions): RUMEvent {
  const name = metric.name as WebVitalName;
  const deviceInfo = options.includeDeviceInfo !== false ? getDeviceInfo() : {};

  return {
    metric: {
      name,
      value: metric.value,
      rating: rateMetric(name, metric.value),
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    },
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    connectionType: deviceInfo.connectionType,
    deviceMemory: deviceInfo.deviceMemory,
    timestamp: new Date(),
    appName: options.appName,
    environment: typeof process !== 'undefined' ? (process.env.NODE_ENV ?? 'development') : 'browser',
  };
}

/** Buffer for batching RUM events before flush */
let eventBuffer: RUMEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(endpoint: string): void {
  if (eventBuffer.length === 0) return;
  const batch = [...eventBuffer];
  eventBuffer = [];

  // Use sendBeacon for reliability during page unload, fallback to fetch
  const payload = JSON.stringify(batch);
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, payload);
  } else if (typeof fetch !== 'undefined') {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // RUM is non-critical — swallow failures
    });
  }
}

function enqueue(event: RUMEvent, options: Required<Pick<RUMReporterOptions, 'endpoint' | 'batchSize' | 'flushIntervalMs'>>): void {
  // Sampling: drop if random exceeds sample rate
  eventBuffer.push(event);

  if (eventBuffer.length >= options.batchSize) {
    flush(options.endpoint);
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flush(options.endpoint);
      flushTimer = null;
    }, options.flushIntervalMs);
  }
}

/**
 * Initialize Web Vitals collection for a Next.js app.
 *
 * Must be called from a client component (browser only).
 */
export async function initWebVitals(options: RUMReporterOptions): Promise<void> {
  if (typeof window === 'undefined') return;

  const sampleRate = options.sampleRate ?? 1.0;
  if (Math.random() > sampleRate) return; // session-level sampling

  const config = {
    endpoint: options.endpoint ?? '/api/rum',
    batchSize: options.batchSize ?? 10,
    flushIntervalMs: options.flushIntervalMs ?? 5_000,
  };

  const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import('web-vitals');

  const handler = (metric: Metric) => {
    const event = metricToRUMEvent(metric, options);
    enqueue(event, config);
  };

  onCLS(handler);
  onFCP(handler);
  onINP(handler);
  onLCP(handler);
  onTTFB(handler);

  // Flush on page hide for maximum data capture
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush(config.endpoint);
    }
  });
}

/** Manually flush all buffered events. Useful for SPA route transitions. */
export function flushWebVitals(endpoint = '/api/rum'): void {
  flush(endpoint);
}
