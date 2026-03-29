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
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
      process.env.CLERK_SECRET_KEY = 'sk_test_abc';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports missing required variables', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain('DATABASE_URL');
    });

    it('reports invalid format for DATABASE_URL', async () => {
      process.env.DATABASE_URL = 'mysql://invalid';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
      process.env.CLERK_SECRET_KEY = 'sk_test_abc';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('throws when throwOnError is true and required vars missing', async () => {
      delete process.env.DATABASE_URL;
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      delete process.env.CLERK_SECRET_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      const { validateEnv } = await import('../env-validator');
      expect(() => validateEnv(true)).toThrow();
    });

    it('adds warnings for missing optional variables', async () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_abc';
      process.env.CLERK_SECRET_KEY = 'sk_test_abc';
      process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';
      delete process.env.SENTRY_DSN;

      const { validateEnv } = await import('../env-validator');
      const result = validateEnv(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
