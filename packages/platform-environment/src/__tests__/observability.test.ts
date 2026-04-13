/**
 * Comprehensive tests for @nzila/platform-environment observability module.
 *
 * Covers: envLog, envMetricName, envAlertTags.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// We control environment via process.env, which flows through
// the actual getEnvironment() and getObservabilityNamespace() functions.

import { envLog, envMetricName, envAlertTags } from '../observability';

describe('observability', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ENVIRONMENT = 'STAGING';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── envLog ──────────────────────────────────────────────────────────

  describe('envLog', () => {
    it('creates a log entry with correct environment', () => {
      const entry = envLog('info', 'test message');

      expect(entry.environment).toBe('STAGING');
      expect(entry.namespace).toBe('nzila.staging');
      expect(entry.level).toBe('info');
      expect(entry.message).toBe('test message');
      expect(entry.timestamp).toBeDefined();
      expect(entry.data).toBeUndefined();
    });

    it('includes data when provided', () => {
      const entry = envLog('error', 'failure', { code: 500, detail: 'timeout' });

      expect(entry.data).toEqual({ code: 500, detail: 'timeout' });
    });

    it('supports all log levels', () => {
      const levels = ['debug', 'info', 'warn', 'error'] as const;
      for (const level of levels) {
        const entry = envLog(level, `message-${level}`);
        expect(entry.level).toBe(level);
      }
    });

    it('uses PRODUCTION namespace when env is PRODUCTION', () => {
      process.env.ENVIRONMENT = 'PRODUCTION';
      const entry = envLog('info', 'prod message');

      expect(entry.environment).toBe('PRODUCTION');
      expect(entry.namespace).toBe('nzila.prod');
    });

    it('uses LOCAL namespace when env is LOCAL', () => {
      process.env.ENVIRONMENT = 'LOCAL';
      const entry = envLog('debug', 'local message');

      expect(entry.environment).toBe('LOCAL');
      expect(entry.namespace).toBe('nzila.local');
    });

    it('returns ISO timestamp', () => {
      const entry = envLog('info', 'test');
      // ISO timestamps are parseable
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    });
  });

  // ── envMetricName ───────────────────────────────────────────────────

  describe('envMetricName', () => {
    it('prefixes metric with environment namespace', () => {
      const metric = envMetricName('api.request_count');

      expect(metric).toBe('nzila.staging.api.request_count');
    });

    it('works for PRODUCTION', () => {
      process.env.ENVIRONMENT = 'PRODUCTION';
      const metric = envMetricName('latency_ms');

      expect(metric).toBe('nzila.prod.latency_ms');
    });

    it('works for LOCAL', () => {
      process.env.ENVIRONMENT = 'LOCAL';
      const metric = envMetricName('error_count');

      expect(metric).toBe('nzila.local.error_count');
    });

    it('works for PREVIEW', () => {
      process.env.ENVIRONMENT = 'PREVIEW';
      const metric = envMetricName('queue.depth');

      expect(metric).toBe('nzila.preview.queue.depth');
    });
  });

  // ── envAlertTags ────────────────────────────────────────────────────

  describe('envAlertTags', () => {
    it('returns environment and namespace tags', () => {
      const tags = envAlertTags();

      expect(tags).toEqual({
        environment: 'STAGING',
        namespace: 'nzila.staging',
      });
    });

    it('returns PRODUCTION tags', () => {
      process.env.ENVIRONMENT = 'PRODUCTION';
      const tags = envAlertTags();

      expect(tags).toEqual({
        environment: 'PRODUCTION',
        namespace: 'nzila.prod',
      });
    });

    it('returns LOCAL tags', () => {
      process.env.ENVIRONMENT = 'LOCAL';
      const tags = envAlertTags();

      expect(tags).toEqual({
        environment: 'LOCAL',
        namespace: 'nzila.local',
      });
    });
  });
});
