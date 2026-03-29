import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  CircuitBreaker,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  CircuitState,
  withCircuitBreaker,
} from '../circuit-breaker';

beforeEach(() => {
  vi.clearAllMocks();
  CircuitBreakerRegistry.resetAll();
});

// ── CircuitState enum ────────────────────────────────────────────────────────

describe('CircuitState', () => {
  it('has expected values', () => {
    expect(CircuitState.CLOSED).toBe('CLOSED');
    expect(CircuitState.OPEN).toBe('OPEN');
    expect(CircuitState.HALF_OPEN).toBe('HALF_OPEN');
  });
});

// ── CircuitBreakerError ──────────────────────────────────────────────────────

describe('CircuitBreakerError', () => {
  it('carries circuit state', () => {
    const err = new CircuitBreakerError('open', CircuitState.OPEN);
    expect(err.name).toBe('CircuitBreakerError');
    expect(err.circuitState).toBe(CircuitState.OPEN);
    expect(err.message).toBe('open');
  });
});

// ── CircuitBreaker ───────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('passes through successful calls', async () => {
    const cb = new CircuitBreaker();
    const result = await cb.execute(async () => 42);
    expect(result).toBe(42);
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('opens after failureThreshold failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 60000 });

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('rejects calls immediately when OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 60000 });
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow('fail');
    expect(cb.getState()).toBe(CircuitState.OPEN);

    await expect(cb.execute(async () => 1)).rejects.toThrow(CircuitBreakerError);
  });

  it('transitions to HALF_OPEN after resetTimeout', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50 });
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitState.OPEN);

    await new Promise(r => setTimeout(r, 60));

    const result = await cb.execute(async () => 'ok');
    expect(result).toBe('ok');
    // After 1 success in HALF_OPEN, still not enough if successThreshold=2
    // But state should be HALF_OPEN or CLOSED
  });

  it('closes after successThreshold successes in HALF_OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50, successThreshold: 2 });
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();

    await new Promise(r => setTimeout(r, 60));

    // First success in HALF_OPEN
    await cb.execute(async () => 'ok1');
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

    // Second success closes circuit
    await cb.execute(async () => 'ok2');
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('opens again on failure in HALF_OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 50, successThreshold: 3 });
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    await new Promise(r => setTimeout(r, 60));

    await expect(cb.execute(async () => { throw new Error('fail again'); })).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('respects errorFilter — filtered errors do not count', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      errorFilter: (err) => err.message.includes('network'),
    });

    await expect(cb.execute(async () => { throw new Error('validation'); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error('validation'); })).rejects.toThrow();
    // Filtered errors should not trip the circuit
    expect(cb.getState()).toBe(CircuitState.CLOSED);

    await expect(cb.execute(async () => { throw new Error('network'); })).rejects.toThrow();
    await expect(cb.execute(async () => { throw new Error('network'); })).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('calls onStateChange callback', async () => {
    const changes: [CircuitState, CircuitState][] = [];
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      onStateChange: (from, to) => changes.push([from, to]),
    });

    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(changes).toEqual([[CircuitState.CLOSED, CircuitState.OPEN]]);
  });

  it('times out long-running operations', async () => {
    const cb = new CircuitBreaker({ timeout: 50 });
    await expect(
      cb.execute(() => new Promise(r => setTimeout(r, 200)))
    ).rejects.toThrow(/timeout/i);
  });

  it('getStats returns correct stats', async () => {
    const cb = new CircuitBreaker({ name: 'test-service', failureThreshold: 2 });
    await expect(cb.execute(async () => { throw new Error('err'); })).rejects.toThrow();

    const stats = cb.getStats();
    expect(stats.state).toBe(CircuitState.CLOSED);
    expect(stats.failureCount).toBe(1);
    expect(stats.lastError).toBe('err');
  });

  it('reset restores to initial state', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });
    await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
    expect(cb.getState()).toBe(CircuitState.OPEN);

    cb.reset();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.getStats().failureCount).toBe(0);
    expect(cb.getStats().lastError).toBeUndefined();
  });

  it('trip manually opens the circuit', () => {
    const cb = new CircuitBreaker();
    cb.trip();
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });
});

// ── CircuitBreakerRegistry ───────────────────────────────────────────────────

describe('CircuitBreakerRegistry', () => {
  it('getOrCreate returns same breaker on repeated calls', () => {
    const a = CircuitBreakerRegistry.getOrCreate('svc-a', { failureThreshold: 3 });
    const b = CircuitBreakerRegistry.getOrCreate('svc-a');
    expect(a).toBe(b);
  });

  it('getAll returns all registered breakers', () => {
    CircuitBreakerRegistry.getOrCreate('x');
    CircuitBreakerRegistry.getOrCreate('y');
    const all = CircuitBreakerRegistry.getAll();
    expect(all.has('x')).toBe(true);
    expect(all.has('y')).toBe(true);
  });

  it('getAllStats returns stats for each breaker', () => {
    CircuitBreakerRegistry.getOrCreate('a');
    const stats = CircuitBreakerRegistry.getAllStats();
    expect(stats.a).toBeDefined();
    expect(stats.a.state).toBe(CircuitState.CLOSED);
  });

  it('resetAll resets every breaker', async () => {
    const b = CircuitBreakerRegistry.getOrCreate('resettable', { failureThreshold: 1 });
    await expect(b.execute(async () => { throw new Error('x'); })).rejects.toThrow();
    expect(b.getState()).toBe(CircuitState.OPEN);

    CircuitBreakerRegistry.resetAll();
    expect(b.getState()).toBe(CircuitState.CLOSED);
  });
});

// ── withCircuitBreaker decorator ─────────────────────────────────────────────

describe('withCircuitBreaker', () => {
  it('wraps a method with circuit breaker protection', async () => {
    const descriptor: PropertyDescriptor = {
      value: async function () { return 'ok'; },
      writable: true,
      enumerable: false,
      configurable: true,
    };

    const wrapped = withCircuitBreaker({ name: 'api-deco', failureThreshold: 1 })(
      {},
      'call',
      descriptor,
    );
    const result = await wrapped.value();
    expect(result).toBe('ok');
  });
});
