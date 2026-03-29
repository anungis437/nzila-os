import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
  circuitBreakers,
  CIRCUIT_BREAKERS,
} from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      threshold: 3,
      timeout: 100,
      successThreshold: 2,
    });
  });

  it('starts in CLOSED state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('passes requests through when CLOSED', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('opens after threshold failures', async () => {
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(fail)).rejects.toThrow('fail');
    }

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('throws CircuitBreakerOpenError when open', async () => {
    breaker.forceOpen();

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow(
      CircuitBreakerOpenError
    );
  });

  it('transitions to HALF_OPEN after timeout', async () => {
    breaker.forceOpen();

    // Wait for timeout + small buffer
    await new Promise((r) => setTimeout(r, 120));

    // Next call should attempt (HALF_OPEN)
    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
  });

  it('closes after enough successes in HALF_OPEN', async () => {
    breaker.forceOpen();
    await new Promise((r) => setTimeout(r, 120));

    // Two successes needed
    await breaker.execute(() => Promise.resolve(1));
    await breaker.execute(() => Promise.resolve(2));

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('executeWithFallback returns fallback when open', async () => {
    breaker.forceOpen();

    const result = await breaker.executeWithFallback(
      () => Promise.resolve('ok'),
      'fallback'
    );
    expect(result).toBe('fallback');
  });

  it('reset returns to CLOSED', () => {
    breaker.forceOpen();
    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.isOpen()).toBe(false);
  });

  it('getStats returns correct totals', async () => {
    await breaker.execute(() => Promise.resolve(1));
    await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow();

    const stats = breaker.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalSuccesses).toBe(1);
    expect(stats.totalFailures).toBe(1);
  });
});

describe('CircuitBreakerRegistry', () => {
  it('returns same breaker for same name', () => {
    const a = circuitBreakers.get('reg-test', CIRCUIT_BREAKERS.REDIS);
    const b = circuitBreakers.get('reg-test', CIRCUIT_BREAKERS.REDIS);
    expect(a).toBe(b);
  });

  it('getAllStats includes registered breakers', () => {
    circuitBreakers.get('stats-test', CIRCUIT_BREAKERS.EXTERNAL_API);
    const stats = circuitBreakers.getAllStats();
    expect(stats).toHaveProperty('stats-test');
  });
});
