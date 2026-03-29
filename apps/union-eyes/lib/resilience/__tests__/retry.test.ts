import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { RetryPolicy, withRetry, retryPolicies } from '../retry';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── RetryPolicy ──────────────────────────────────────────────────────────────

describe('RetryPolicy', () => {
  it('succeeds on first attempt without retry', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, jitter: false, initialDelay: 1 });
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await policy.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and eventually succeeds', async () => {
    const policy = new RetryPolicy({ maxAttempts: 3, initialDelay: 1, jitter: false });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce('ok');
    const result = await policy.execute(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after maxAttempts exhausted', async () => {
    const policy = new RetryPolicy({ maxAttempts: 2, initialDelay: 1, jitter: false });
    const fn = vi.fn().mockRejectedValue(new Error('always-fail'));
    await expect(policy.execute(fn)).rejects.toThrow('always-fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects retryableError filter — non-retryable error throws immediately', async () => {
    const policy = new RetryPolicy({
      maxAttempts: 5,
      initialDelay: 1,
      retryableError: (err) => err.message.includes('transient'),
    });
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));
    await expect(policy.execute(fn)).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback for each retry', async () => {
    const onRetry = vi.fn();
    const policy = new RetryPolicy({ maxAttempts: 3, initialDelay: 1, jitter: false, onRetry });
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValue('ok');
    await policy.execute(fn);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'e1' }), 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.objectContaining({ message: 'e2' }), 2);
  });

  describe('backoff strategies', () => {
    it('fixed: constant delay', async () => {
      const policy = new RetryPolicy({ maxAttempts: 2, initialDelay: 10, backoff: 'fixed', jitter: false });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const start = Date.now();
      await expect(policy.execute(fn)).rejects.toThrow();
      expect(Date.now() - start).toBeGreaterThanOrEqual(5);
    });

    it('linear: multiplicative delay', async () => {
      const policy = new RetryPolicy({ maxAttempts: 2, initialDelay: 10, backoff: 'linear', jitter: false });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(policy.execute(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('exponential: default strategy', async () => {
      const policy = new RetryPolicy({ maxAttempts: 2, initialDelay: 10, backoff: 'exponential', jitter: false });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(policy.execute(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  it('respects maxDelay cap', async () => {
    const policy = new RetryPolicy({
      maxAttempts: 2,
      initialDelay: 100000,
      maxDelay: 10,
      backoff: 'fixed',
      jitter: false,
    });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const start = Date.now();
    await expect(policy.execute(fn)).rejects.toThrow();
    // Should not wait anywhere close to 100s — capped at 10ms
    expect(Date.now() - start).toBeLessThan(500);
  });
});

// ── withRetry helper ─────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('retries function with defaults', async () => {
    let attempt = 0;
    const result = await withRetry(async () => {
      attempt++;
      if (attempt < 2) throw new Error('retry');
      return 'done';
    }, { maxAttempts: 3, initialDelay: 1, jitter: false });
    expect(result).toBe('done');
  });
});

// ── retryPolicies presets ────────────────────────────────────────────────────

describe('retryPolicies', () => {
  it('has quick preset', () => {
    expect(retryPolicies.quick).toBeInstanceOf(RetryPolicy);
  });

  it('has standard preset', () => {
    expect(retryPolicies.standard).toBeInstanceOf(RetryPolicy);
  });

  it('has aggressive preset', () => {
    expect(retryPolicies.aggressive).toBeInstanceOf(RetryPolicy);
  });

  it('has database preset', () => {
    expect(retryPolicies.database).toBeInstanceOf(RetryPolicy);
  });
});
