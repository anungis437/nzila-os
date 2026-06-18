import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  IntegrationError,
  RateLimitError,
} from '../errors';

describe('lib/integrations/errors', () => {
  describe('IntegrationError', () => {
    it('captures message, code, statusCode, and details', () => {
      const err = new IntegrationError('boom', 'CUSTOM', 500, { extra: true });
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(IntegrationError);
      expect(err.message).toBe('boom');
      expect(err.name).toBe('IntegrationError');
      expect(err.code).toBe('CUSTOM');
      expect(err.statusCode).toBe(500);
      expect(err.details).toEqual({ extra: true });
    });

    it('allows omitting the optional fields', () => {
      const err = new IntegrationError('only message');
      expect(err.code).toBeUndefined();
      expect(err.statusCode).toBeUndefined();
      expect(err.details).toBeUndefined();
    });
  });

  describe('AuthenticationError', () => {
    it('defaults to a 401 AUTH_ERROR', () => {
      const err = new AuthenticationError();
      expect(err).toBeInstanceOf(IntegrationError);
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.name).toBe('AuthenticationError');
      expect(err.message).toBe('Authentication failed');
      expect(err.code).toBe('AUTH_ERROR');
      expect(err.statusCode).toBe(401);
    });

    it('accepts a custom message and details', () => {
      const err = new AuthenticationError('nope', { reason: 'expired' });
      expect(err.message).toBe('nope');
      expect(err.details).toEqual({ reason: 'expired' });
    });
  });

  describe('RateLimitError', () => {
    it('defaults to a 429 RATE_LIMIT_ERROR', () => {
      const err = new RateLimitError();
      expect(err).toBeInstanceOf(IntegrationError);
      expect(err).toBeInstanceOf(RateLimitError);
      expect(err.name).toBe('RateLimitError');
      expect(err.message).toBe('Rate limit exceeded');
      expect(err.code).toBe('RATE_LIMIT_ERROR');
      expect(err.statusCode).toBe(429);
      expect(err.retryAfter).toBeUndefined();
    });

    it('carries retryAfter and details', () => {
      const err = new RateLimitError('slow down', 30, { bucket: 'sms' });
      expect(err.message).toBe('slow down');
      expect(err.retryAfter).toBe(30);
      expect(err.details).toEqual({ bucket: 'sms' });
    });
  });
});
