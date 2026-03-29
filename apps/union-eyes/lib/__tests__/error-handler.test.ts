import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  DatabaseError,
  ExternalAPIError,
  ErrorType,
  safeAsync,
  safeAsyncWithDefault,
  handleAPIError,
  isOperationalError,
  retryWithBackoff,
  withDatabaseErrorHandling,
  errorBoundary,
} from '../error-handler';

describe('error-handler', () => {
  describe('AppError', () => {
    it('sets type and status code', () => {
      const err = new AppError('fail', ErrorType.DATABASE, 500);
      expect(err.type).toBe(ErrorType.DATABASE);
      expect(err.statusCode).toBe(500);
      expect(err.isOperational).toBe(true);
    });
  });

  describe('ValidationError', () => {
    it('creates 400 error', () => {
      const err = new ValidationError('bad input');
      expect(err.statusCode).toBe(400);
      expect(err.type).toBe(ErrorType.VALIDATION);
    });
  });

  describe('NotFoundError', () => {
    it('creates 404 with resource name', () => {
      const err = new NotFoundError('User', '123');
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('User');
      expect(err.message).toContain('123');
    });

    it('handles missing identifier', () => {
      const err = new NotFoundError('Order');
      expect(err.message).toBe('Order not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('creates 401 error', () => {
      expect(new UnauthorizedError().statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('creates 403 error', () => {
      expect(new ForbiddenError().statusCode).toBe(403);
    });
  });

  describe('DatabaseError', () => {
    it('creates 500 error with context', () => {
      const err = new DatabaseError('connection lost', { host: 'db1' });
      expect(err.statusCode).toBe(500);
      expect(err.context).toEqual({ host: 'db1' });
    });
  });

  describe('ExternalAPIError', () => {
    it('includes service name in message', () => {
      const err = new ExternalAPIError('Stripe', 'timeout');
      expect(err.message).toBe('Stripe: timeout');
      expect(err.statusCode).toBe(502);
    });
  });

  describe('safeAsync', () => {
    it('returns value on success', async () => {
      const result = await safeAsync(() => Promise.resolve(42), 'fail');
      expect(result).toBe(42);
    });

    it('re-throws after logging', async () => {
      await expect(
        safeAsync(() => Promise.reject(new Error('boom')), 'oops'),
      ).rejects.toThrow('boom');
    });

    it('handles non-Error throw and logs string', async () => {
      await expect(
        safeAsync(() => Promise.reject('string-error'), 'oops'),
      ).rejects.toBe('string-error');
    });
  });

  describe('safeAsyncWithDefault', () => {
    it('returns value on success', async () => {
      const r = await safeAsyncWithDefault(() => Promise.resolve(5), 0);
      expect(r).toBe(5);
    });

    it('returns default on error', async () => {
      const r = await safeAsyncWithDefault(() => Promise.reject(new Error('x')), 99, 'warn');
      expect(r).toBe(99);
    });

    it('returns default on error without errorMessage (no logging)', async () => {
      const r = await safeAsyncWithDefault(
        () => Promise.reject(new Error('silent')),
        'fallback',
      );
      expect(r).toBe('fallback');
    });

    it('handles non-Error throw with errorMessage', async () => {
      const r = await safeAsyncWithDefault(
        () => Promise.reject('string-error'),
        42,
        'warning-msg',
      );
      expect(r).toBe(42);
    });
  });

  describe('handleAPIError', () => {
    it('maps AppError to response', () => {
      const resp = handleAPIError(new ValidationError('bad'));
      expect(resp.statusCode).toBe(400);
      expect(resp.type).toBe(ErrorType.VALIDATION);
    });

    it('returns 500 for generic errors', () => {
      const resp = handleAPIError(new Error('unknown'));
      expect(resp.statusCode).toBe(500);
    });

    it('handles non-Error objects', () => {
      const resp = handleAPIError('oops');
      expect(resp.statusCode).toBe(500);
    });
  });

  describe('isOperationalError', () => {
    it('returns true for operational AppErrors', () => {
      expect(isOperationalError(new ValidationError('x'))).toBe(true);
    });

    it('returns false for non-AppErrors', () => {
      expect(isOperationalError(new Error('x'))).toBe(false);
    });
  });

  describe('retryWithBackoff', () => {
    it('returns value on first success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await retryWithBackoff(fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure then succeeds', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockResolvedValue('ok');

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 10,
      });
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always-fail'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, initialDelay: 1 })
      ).rejects.toThrow('always-fail');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('invokes onRetry callback', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('ok');

      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        onRetry,
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('caps delay at maxDelay', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('a'))
        .mockRejectedValueOnce(new Error('b'))
        .mockResolvedValue('ok');

      const start = Date.now();
      await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 5,
        backoffMultiplier: 100,
      });
      // Should complete very quickly since maxDelay caps at 5ms
      expect(Date.now() - start).toBeLessThan(500);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('wraps non-Error throws into Error', async () => {
      const fn = vi.fn().mockRejectedValue('string-error');

      await expect(
        retryWithBackoff(fn, { maxRetries: 1, initialDelay: 1 })
      ).rejects.toThrow('string-error');
    });
  });

  describe('withDatabaseErrorHandling', () => {
    it('returns value on success', async () => {
      const result = await withDatabaseErrorHandling(
        () => Promise.resolve(42),
        'fetchUser'
      );
      expect(result).toBe(42);
    });

    it('wraps error into DatabaseError', async () => {
      await expect(
        withDatabaseErrorHandling(
          () => Promise.reject(new Error('connection reset')),
          'updateUser',
          { userId: '123' }
        )
      ).rejects.toThrow(DatabaseError);
    });

    it('includes operation name in thrown error message', async () => {
      await expect(
        withDatabaseErrorHandling(
          () => Promise.reject(new Error('timeout')),
          'deleteRecord'
        )
      ).rejects.toThrow('deleteRecord failed');
    });

    it('preserves context in DatabaseError', async () => {
      try {
        await withDatabaseErrorHandling(
          () => Promise.reject(new Error('err')),
          'op',
          { table: 'claims' }
        );
      } catch (e) {
        expect(e).toBeInstanceOf(DatabaseError);
        expect((e as DatabaseError).context).toEqual(
          expect.objectContaining({ table: 'claims' })
        );
      }
    });

    it('handles non-Error throw in withDatabaseErrorHandling', async () => {
      await expect(
        withDatabaseErrorHandling(
          () => Promise.reject('string-db-error'),
          'insertRecord',
        )
      ).rejects.toThrow('insertRecord failed');
    });
  });

  describe('errorBoundary', () => {
    it('returns value on success', async () => {
      const result = await errorBoundary(() => Promise.resolve('ok'));
      expect(result).toBe('ok');
    });

    it('returns null on error when no fallback', async () => {
      const result = await errorBoundary(() => Promise.reject(new Error('boom')));
      expect(result).toBeNull();
    });

    it('returns custom fallback on error', async () => {
      const result = await errorBoundary(
        () => Promise.reject(new Error('boom')),
        'default-val',
        'Something went wrong'
      );
      expect(result).toBe('default-val');
    });

    it('logs error when logMessage provided', async () => {
      const { logger } = await import('@/lib/logger');

      await errorBoundary(
        () => Promise.reject(new Error('test')),
        null,
        'Error during operation'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Error during operation',
        expect.objectContaining({ error: 'test' })
      );
    });

    it('handles non-Error throw in errorBoundary', async () => {
      const result = await errorBoundary(
        () => Promise.reject('non-error-value'),
        'safe-default',
        'caught non-error',
      );
      expect(result).toBe('safe-default');
    });

    it('returns fallback without logging when no logMessage', async () => {
      const result = await errorBoundary(
        () => Promise.reject('silent-error'),
        'default',
      );
      expect(result).toBe('default');
    });
  });
});
