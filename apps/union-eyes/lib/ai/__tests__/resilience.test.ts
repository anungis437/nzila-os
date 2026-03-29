import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { CircuitBreaker, TokenBucketRateLimiter, CircuitState } from '../resilience';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Happy path
  // ────────────────────────────────────────────────────────────────
  it('starts in CLOSED state', () => {
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.isAvailable()).toBe(true);
  });

  it('executes operation successfully in CLOSED state', async () => {
    const result = await cb.execute(async () => 42);
    expect(result).toBe(42);
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('tracks successes', async () => {
    await cb.execute(async () => 'ok');
    const stats = cb.getStats();
    expect(stats.successes).toBe(1);
    expect(stats.lastSuccess).not.toBeNull();
  });

  // ────────────────────────────────────────────────────────────────
  // Failure → OPEN transition
  // ────────────────────────────────────────────────────────────────
  it('opens circuit after threshold failures', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);
    expect(cb.isAvailable()).toBe(false);
  });

  it('throws when circuit is OPEN and no fallback', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    }
    await expect(cb.execute(async () => 'should not run')).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('uses fallback when circuit is OPEN', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    }
    const result = await cb.execute(
      async () => 'primary',
      async () => 'fallback'
    );
    expect(result).toBe('fallback');
  });

  it('resets failure count on success in CLOSED state', async () => {
    // 2 failures (below threshold)
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    // 1 success resets
    await cb.execute(async () => 'ok');
    const stats = cb.getStats();
    expect(stats.failures).toBe(0);
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  // ────────────────────────────────────────────────────────────────
  // HALF_OPEN transition
  // ────────────────────────────────────────────────────────────────
  it('transitions to HALF_OPEN after timeout expires', async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) {
        await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      }
      expect(cb.getState()).toBe(CircuitState.OPEN);

      // Advance past timeout
      vi.advanceTimersByTime(1100);

      // Next call should attempt (HALF_OPEN)
      await cb.execute(async () => 'probe');
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes circuit after enough successes in HALF_OPEN', async () => {
    vi.useFakeTimers();
    try {
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      }

      vi.advanceTimersByTime(1100);

      // Enough successes to close
      await cb.execute(async () => 'ok');  // transitions to HALF_OPEN
      await cb.execute(async () => 'ok');  // successThreshold=2, should close
      expect(cb.getState()).toBe(CircuitState.CLOSED);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reopens circuit on failure in HALF_OPEN', async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < 3; i++) {
        await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
      }

      vi.advanceTimersByTime(1100);

      // HALF_OPEN probe
      await cb.execute(async () => 'ok');
      expect(cb.getState()).toBe(CircuitState.HALF_OPEN);

      // Failure in HALF_OPEN → back to OPEN
      await cb.execute(async () => { throw new Error('fail again'); }).catch(() => {});
      expect(cb.getState()).toBe(CircuitState.OPEN);
    } finally {
      vi.useRealTimers();
    }
  });

  // ────────────────────────────────────────────────────────────────
  // Reset
  // ────────────────────────────────────────────────────────────────
  it('reset() restores to clean CLOSED state', async () => {
    for (let i = 0; i < 3; i++) {
      await cb.execute(async () => { throw new Error('fail'); }).catch(() => {});
    }
    expect(cb.getState()).toBe(CircuitState.OPEN);

    cb.reset();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(cb.isAvailable()).toBe(true);
    const stats = cb.getStats();
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
  });
});

describe('TokenBucketRateLimiter', () => {
  it('allows requests within capacity', () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({
        capacity: 10,
        refillRate: 1,
        windowMs: 60000,
      });
      expect(limiter.tryConsume('user1', 1)).toBe(true);
      expect(limiter.getRemaining('user1')).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects when tokens exhausted', () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 2,
      refillRate: 0,
      windowMs: 60000,
    });
    expect(limiter.tryConsume('user1', 1)).toBe(true);
    expect(limiter.tryConsume('user1', 1)).toBe(true);
    expect(limiter.tryConsume('user1', 1)).toBe(false);
  });

  it('refills tokens over time', () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({
        capacity: 10,
        refillRate: 10, // 10 tokens/second
        windowMs: 60000,
      });

      // Consume all tokens
      limiter.tryConsume('user1', 10);
      expect(limiter.getRemaining('user1')).toBe(0);

      // Advance 1 second → should have ~10 tokens refilled
      vi.advanceTimersByTime(1000);
      expect(limiter.getRemaining('user1')).toBeGreaterThanOrEqual(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it('isolates keys', () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRate: 0,
      windowMs: 60000,
    });
    limiter.tryConsume('user1', 3);
    limiter.tryConsume('user2', 1);
    expect(limiter.getRemaining('user1')).toBe(2);
    expect(limiter.getRemaining('user2')).toBe(4);
  });

  it('respects capacity ceiling', () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({
        capacity: 5,
        refillRate: 100,
        windowMs: 60000,
      });
      limiter.tryConsume('user1', 1);
      vi.advanceTimersByTime(10000); // way more than needed to refill
      expect(limiter.getRemaining('user1')).toBe(5); // capped at capacity
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns future reset time', () => {
    const limiter = new TokenBucketRateLimiter({
      capacity: 10,
      refillRate: 1,
      windowMs: 60000,
    });
    limiter.tryConsume('user1', 1);
    const reset = limiter.getResetTime('user1');
    expect(reset).toBeGreaterThan(Date.now());
  });

  it('cleanup removes stale entries', () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({
        capacity: 10,
        refillRate: 1,
        windowMs: 1000,
      });
      limiter.tryConsume('stale', 1);
      vi.advanceTimersByTime(2000);
      limiter.cleanup();
      // After cleanup, getting remaining for 'stale' creates a fresh bucket
      expect(limiter.getRemaining('stale')).toBe(10);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles high-cost consumption', () => {
    vi.useFakeTimers();
    try {
      const limiter = new TokenBucketRateLimiter({
        capacity: 100,
        refillRate: 1,
        windowMs: 60000,
      });
      expect(limiter.tryConsume('user1', 50)).toBe(true);
      expect(limiter.getRemaining('user1')).toBe(50);
      expect(limiter.tryConsume('user1', 51)).toBe(false);
      expect(limiter.tryConsume('user1', 50)).toBe(true);
      expect(limiter.getRemaining('user1')).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
