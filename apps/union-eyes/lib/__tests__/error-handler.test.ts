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
});
