import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CRON_API_ROUTES,
  PUBLIC_API_ROUTES,
  getAllPublicRoutes,
  isCronRoute,
  isPublicRoute,
  matchesRoutePattern,
} from '../public-api-routes';

describe('config/public-api-routes', () => {
  describe('matchesRoutePattern', () => {
    it('matches exact paths', () => {
      expect(matchesRoutePattern('/api/health', '/api/health')).toBe(true);
      expect(matchesRoutePattern('/api/health', '/api/health/liveness')).toBe(false);
    });

    it('expands wildcard segments', () => {
      expect(
        matchesRoutePattern('/api/communications/track/open/*', '/api/communications/track/open/abc123'),
      ).toBe(true);
      expect(
        matchesRoutePattern('/api/communications/unsubscribe/*', '/api/communications/unsubscribe/token-xyz'),
      ).toBe(true);
    });

    it('expands [param] placeholders to a single segment matcher', () => {
      expect(matchesRoutePattern('/api/users/[id]', '/api/users/42')).toBe(true);
      // [param] is a single segment, so an extra slash should not match.
      expect(matchesRoutePattern('/api/users/[id]', '/api/users/42/details')).toBe(false);
    });
  });

  describe('isPublicRoute', () => {
    it('returns true for an allow-listed public route', () => {
      expect(isPublicRoute('/api/health')).toBe(true);
      expect(isPublicRoute('/api/webhooks/stripe')).toBe(true);
    });

    it('returns false for routes not in the allowlist', () => {
      expect(isPublicRoute('/api/members/secret')).toBe(false);
    });
  });

  describe('isCronRoute', () => {
    it('returns true for cron routes', () => {
      expect(isCronRoute('/api/cron/monthly-dues')).toBe(true);
      expect(isCronRoute('/api/rewards/cron')).toBe(true);
    });

    it('returns false for non-cron routes', () => {
      expect(isCronRoute('/api/health')).toBe(false);
    });
  });

  describe('getAllPublicRoutes', () => {
    it('returns every public and cron route pattern', () => {
      const all = getAllPublicRoutes();
      expect(all).toEqual([
        ...PUBLIC_API_ROUTES.map((r) => r.pattern),
        ...CRON_API_ROUTES.map((r) => r.pattern),
      ]);
      expect(all).toContain('/api/health');
      expect(all).toContain('/api/cron/monthly-dues');
    });
  });

  describe('DEV_ONLY_PUBLIC_ROUTES branch', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    beforeEach(() => {
      vi.resetModules();
    });

    it('includes the dev-only sentry route outside production', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const mod = await import('../public-api-routes');
      expect(mod.isPublicRoute('/api/sentry-example-api')).toBe(true);
    });

    it('excludes the dev-only sentry route in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const mod = await import('../public-api-routes');
      expect(mod.isPublicRoute('/api/sentry-example-api')).toBe(false);
    });

    it('restores the original NODE_ENV for the remaining suite', () => {
      expect(process.env.NODE_ENV).toBe(originalEnv);
    });
  });
});
