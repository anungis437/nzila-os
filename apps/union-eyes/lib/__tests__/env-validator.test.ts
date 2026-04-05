/**
 * Tests for env-validator.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('env-validator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('validateEnv', () => {
    it('returns valid when all required vars are set', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.AUTH_SECRET = 'dev_secret_placeholder_32chars_xxxxxxxxxx';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports missing required variables', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.AUTH_SECRET;
      delete process.env.STRIPE_SECRET_KEY;

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain('DATABASE_URL');
    });

    it('reports invalid format for DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'mysql://invalid';
      process.env.AUTH_SECRET = 'dev_secret_placeholder_32chars_xxxxxxxxxx';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('throws when throwOnError is true and required vars missing', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.AUTH_SECRET;
      delete process.env.STRIPE_SECRET_KEY;

      const { validateEnv } = await import('../env-validator');
      expect(() => validateEnv(true)).toThrow();
    });

    it('adds warnings for missing optional variables', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.AUTH_SECRET = 'dev_secret_placeholder_32chars_xxxxxxxxxx';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';
      delete process.env.SENTRY_DSN;

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('isEnvSet', () => {
    it('returns true when variable is set', async () => {
      process.env.TEST_VAR_IS_SET = 'some-value';
      const { isEnvSet } = await import('../env-validator');
      expect(isEnvSet('TEST_VAR_IS_SET')).toBe(true);
    });

    it('returns false when variable is empty string', async () => {
      process.env.TEST_VAR_EMPTY = '';
      const { isEnvSet } = await import('../env-validator');
      expect(isEnvSet('TEST_VAR_EMPTY')).toBe(false);
    });

    it('returns false when variable is not set', async () => {
      delete process.env.TEST_VAR_MISSING;
      const { isEnvSet } = await import('../env-validator');
      expect(isEnvSet('TEST_VAR_MISSING')).toBe(false);
    });
  });

  describe('requireEnv', () => {
    it('returns value when variable is set', async () => {
      process.env.TEST_REQUIRED = 'my-value';
      const { requireEnv } = await import('../env-validator');
      expect(requireEnv('TEST_REQUIRED')).toBe('my-value');
    });

    it('throws when variable is not set', async () => {
      delete process.env.TEST_REQUIRED_MISSING;
      const { requireEnv } = await import('../env-validator');
      expect(() => requireEnv('TEST_REQUIRED_MISSING')).toThrow(
        'Required environment variable TEST_REQUIRED_MISSING is not set'
      );
    });

    it('includes description in error message when provided', async () => {
      delete process.env.TEST_REQ_DESC;
      const { requireEnv } = await import('../env-validator');
      expect(() => requireEnv('TEST_REQ_DESC', 'The API key')).toThrow(
        'Description: The API key'
      );
    });

    it('throws when variable is empty', async () => {
      process.env.TEST_REQUIRED_EMPTY = '';
      const { requireEnv } = await import('../env-validator');
      expect(() => requireEnv('TEST_REQUIRED_EMPTY')).toThrow();
    });
  });

  describe('getEnv', () => {
    it('returns value when variable is set', async () => {
      process.env.TEST_GET_ENV = 'production';
      const { getEnv } = await import('../env-validator');
      expect(getEnv('TEST_GET_ENV', 'default')).toBe('production');
    });

    it('returns default when variable is not set', async () => {
      delete process.env.TEST_GET_ENV_MISSING;
      const { getEnv } = await import('../env-validator');
      expect(getEnv('TEST_GET_ENV_MISSING', 'fallback')).toBe('fallback');
    });

    it('returns default when variable is empty', async () => {
      process.env.TEST_GET_ENV_EMPTY = '';
      const { getEnv } = await import('../env-validator');
      expect(getEnv('TEST_GET_ENV_EMPTY', 'fallback')).toBe('fallback');
    });
  });

  describe('checkEnv', () => {
    it('returns validation result without throwing', async () => {
      delete process.env.DATABASE_URL;
      const { checkEnv } = await import('../env-validator');
      const result = checkEnv();
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
    });
  });
});
