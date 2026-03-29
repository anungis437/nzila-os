/**
 * Tests for public-routes.ts
 *
 * Pure functions: isPublicRoute, isCronRoute
 * Constants: PUBLIC_API_ROUTES, CRON_API_ROUTES
 */
import { describe, it, expect } from 'vitest';
import {
  isPublicRoute,
  isCronRoute,
  PUBLIC_API_ROUTES,
  CRON_API_ROUTES,
} from '../public-routes';

describe('public-routes', () => {
  // ── PUBLIC_API_ROUTES ──────────────────────────────────────────────────
  describe('PUBLIC_API_ROUTES', () => {
    it('is a Set', () => {
      expect(PUBLIC_API_ROUTES).toBeInstanceOf(Set);
    });

    it('includes health check routes', () => {
      expect(PUBLIC_API_ROUTES.has('/api/health')).toBe(true);
      expect(PUBLIC_API_ROUTES.has('/api/health/liveness')).toBe(true);
      expect(PUBLIC_API_ROUTES.has('/api/status')).toBe(true);
    });

    it('includes webhook routes', () => {
      expect(PUBLIC_API_ROUTES.has('/api/webhooks/stripe')).toBe(true);
      expect(PUBLIC_API_ROUTES.has('/api/webhooks/clc')).toBe(true);
    });

    it('includes tracking prefix routes', () => {
      expect(PUBLIC_API_ROUTES.has('/api/communications/track/')).toBe(true);
      expect(PUBLIC_API_ROUTES.has('/api/communications/unsubscribe/')).toBe(true);
    });
  });

  // ── CRON_API_ROUTES ────────────────────────────────────────────────────
  describe('CRON_API_ROUTES', () => {
    it('is a Set', () => {
      expect(CRON_API_ROUTES).toBeInstanceOf(Set);
    });

    it('includes cron routes', () => {
      expect(CRON_API_ROUTES.has('/api/cron/monthly-dues')).toBe(true);
      expect(CRON_API_ROUTES.has('/api/cron/overdue-notifications')).toBe(true);
    });
  });

  // ── isPublicRoute ──────────────────────────────────────────────────────
  describe('isPublicRoute', () => {
    it('returns true for exact match', () => {
      expect(isPublicRoute('/api/health')).toBe(true);
    });

    it('returns true for prefix match (trailing /)', () => {
      expect(isPublicRoute('/api/communications/track/email/abc123')).toBe(true);
    });

    it('returns true for unsubscribe prefix', () => {
      expect(isPublicRoute('/api/communications/unsubscribe/tok-1')).toBe(true);
    });

    it('returns false for non-matching route', () => {
      expect(isPublicRoute('/api/members')).toBe(false);
    });

    it('returns false for partial match that is not prefix', () => {
      expect(isPublicRoute('/api/healthcheck')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isPublicRoute('')).toBe(false);
    });
  });

  // ── isCronRoute ────────────────────────────────────────────────────────
  describe('isCronRoute', () => {
    it('returns true for exact cron route', () => {
      expect(isCronRoute('/api/cron/monthly-dues')).toBe(true);
    });

    it('returns true for another cron route', () => {
      expect(isCronRoute('/api/cron/scheduled-reports')).toBe(true);
    });

    it('returns false for non-cron route', () => {
      expect(isCronRoute('/api/claims')).toBe(false);
    });

    it('returns false for partial cron route', () => {
      expect(isCronRoute('/api/cron')).toBe(false);
    });
  });
});
