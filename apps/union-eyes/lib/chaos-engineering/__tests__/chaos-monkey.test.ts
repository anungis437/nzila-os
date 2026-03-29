import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ChaosMonkey,
  ChaosError,
  type ChaosConfig,
  type LatencyConfig,
  type ErrorConfig,
  type ResourceConfig,
} from '../chaos-monkey';

describe('ChaosError', () => {
  it('creates error with defaults', () => {
    const err = new ChaosError('boom');
    expect(err.message).toBe('boom');
    expect(err.code).toBe(500);
    expect(err.chaosType).toBe('unknown');
    expect(err.name).toBe('ChaosError');
    expect(err).toBeInstanceOf(Error);
  });

  it('creates error with custom code and type', () => {
    const err = new ChaosError('net fail', 503, 'network-failure');
    expect(err.code).toBe(503);
    expect(err.chaosType).toBe('network-failure');
  });
});

describe('ChaosMonkey', () => {
  let monkey: ChaosMonkey;

  beforeEach(() => {
    monkey = new ChaosMonkey({ enabled: true, seed: 42 });
  });

  // ── enable / disable ──────────────────────────────────────────────

  it('reports enabled state', () => {
    expect(monkey.isEnabled()).toBe(true);
  });

  it('can be disabled', () => {
    monkey.disable();
    expect(monkey.isEnabled()).toBe(false);
  });

  it('can be re-enabled', () => {
    monkey.disable();
    monkey.enable();
    expect(monkey.isEnabled()).toBe(true);
  });

  // ── seeded random determinism ─────────────────────────────────────

  it('produces deterministic outputs with same seed', () => {
    const m1 = new ChaosMonkey({ enabled: true, seed: 99 });
    const m2 = new ChaosMonkey({ enabled: true, seed: 99 });

    // Both should either throw or not throw for the same probability
    const results: boolean[] = [];
    for (const m of [m1, m2]) {
      try {
        m.injectError({ probability: 0.5 });
        results.push(false);
      } catch {
        results.push(true);
      }
    }
    expect(results[0]).toBe(results[1]);
  });

  // ── injectLatency ─────────────────────────────────────────────────

  it('skips latency when disabled', async () => {
    monkey.disable();
    const start = Date.now();
    await monkey.injectLatency({ probability: 1.0, minMs: 500, maxMs: 1000 });
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('skips latency when probability is 0', async () => {
    const start = Date.now();
    await monkey.injectLatency({ probability: 0, minMs: 500, maxMs: 1000 });
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('injects latency when probability is 1', async () => {
    vi.useFakeTimers();
    const promise = monkey.injectLatency({ probability: 1.0, minMs: 10, maxMs: 20 });
    await vi.advanceTimersByTimeAsync(50);
    await promise;
    vi.useRealTimers();
  });

  // ── injectError ───────────────────────────────────────────────────

  it('throws ChaosError when probability is 1', () => {
    expect(() =>
      monkey.injectError({ probability: 1.0, errorCode: 502, errorMessage: 'bad gw' })
    ).toThrow(ChaosError);
  });

  it('thrown error has correct fields', () => {
    try {
      monkey.injectError({ probability: 1.0, errorCode: 418, errorMessage: 'teapot' });
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ChaosError);
      expect((e as ChaosError).code).toBe(418);
      expect((e as ChaosError).chaosType).toBe('error-injection');
      expect((e as ChaosError).message).toBe('teapot');
    }
  });

  it('uses default code 500 and message when not specified', () => {
    try {
      monkey.injectError({ probability: 1.0 });
      expect.unreachable('should throw');
    } catch (e) {
      expect((e as ChaosError).code).toBe(500);
      expect((e as ChaosError).message).toBe('Chaos-induced error');
    }
  });

  it('does not throw when probability is 0', () => {
    expect(() => monkey.injectError({ probability: 0 })).not.toThrow();
  });

  it('does not throw when disabled', () => {
    monkey.disable();
    expect(() => monkey.injectError({ probability: 1.0 })).not.toThrow();
  });

  // ── injectNetworkFailure ──────────────────────────────────────────

  it('throws network failure ChaosError at p=1', () => {
    try {
      monkey.injectNetworkFailure(1.0);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ChaosError);
      expect((e as ChaosError).chaosType).toBe('network-failure');
      expect((e as ChaosError).code).toBe(503);
    }
  });

  it('does not throw network failure when disabled', () => {
    monkey.disable();
    expect(() => monkey.injectNetworkFailure(1.0)).not.toThrow();
  });

  // ── injectDatabaseFailure ─────────────────────────────────────────

  it('throws database failure ChaosError at p=1', () => {
    try {
      monkey.injectDatabaseFailure(1.0);
      expect.unreachable('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ChaosError);
      expect((e as ChaosError).chaosType).toBe('database-failure');
      expect((e as ChaosError).code).toBe(500);
    }
  });

  it('does not throw database failure when disabled', () => {
    monkey.disable();
    expect(() => monkey.injectDatabaseFailure(1.0)).not.toThrow();
  });

  // ── injectResourceExhaustion ──────────────────────────────────────

  it('skips resource exhaustion when disabled', async () => {
    monkey.disable();
    await monkey.injectResourceExhaustion({ probability: 1.0, type: 'memory', durationMs: 100 });
    // Should not hang
  });

  it('skips resource exhaustion when probability is 0', async () => {
    await monkey.injectResourceExhaustion({ probability: 0, type: 'cpu', durationMs: 100 });
  });

  it('handles disk type with warning', async () => {
    await monkey.injectResourceExhaustion({ probability: 1.0, type: 'disk', durationMs: 10 });
    // disk exhaustion logs a warning but does nothing
  });

  // ── config types ──────────────────────────────────────────────────

  it('ChaosConfig accepts environment', () => {
    const cfg: ChaosConfig = { enabled: true, environment: 'staging', seed: 1 };
    const m = new ChaosMonkey(cfg);
    expect(m.isEnabled()).toBe(true);
  });

  it('LatencyConfig shape', () => {
    const cfg: LatencyConfig = { probability: 0.5, minMs: 10, maxMs: 100 };
    expect(cfg.probability).toBe(0.5);
  });

  it('ErrorConfig shape', () => {
    const cfg: ErrorConfig = { probability: 0.2, errorCode: 503, errorMessage: 'fail' };
    expect(cfg.errorCode).toBe(503);
  });

  it('ResourceConfig shape', () => {
    const cfg: ResourceConfig = { probability: 0.1, type: 'cpu', durationMs: 1000 };
    expect(cfg.type).toBe('cpu');
  });
});
