import { describe, expect, it } from 'vitest';

import {
  CLAIM_TOKEN_TTL_DAYS,
  computeClaimExpiry,
  generateClaimToken,
  isClaimExpired,
} from '../claim-tokens';

describe('lib/icra/claim-tokens', () => {
  it('exposes a 30-day TTL constant', () => {
    expect(CLAIM_TOKEN_TTL_DAYS).toBe(30);
  });

  describe('generateClaimToken', () => {
    it('produces a base64url string with no padding', () => {
      const token = generateClaimToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token).not.toContain('=');
    });

    it('produces unique tokens', () => {
      expect(generateClaimToken()).not.toBe(generateClaimToken());
    });
  });

  describe('computeClaimExpiry', () => {
    it('adds exactly 30 UTC days to the given instant', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      const expiry = computeClaimExpiry(now);
      expect(expiry.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    });

    it('does not mutate the input date', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      computeClaimExpiry(now);
      expect(now.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('isClaimExpired', () => {
    it('returns false when no expiry is set', () => {
      expect(isClaimExpired(null)).toBe(false);
      expect(isClaimExpired(undefined)).toBe(false);
    });

    it('returns true when the expiry is in the past', () => {
      const now = new Date('2026-01-10T00:00:00.000Z');
      expect(isClaimExpired(new Date('2026-01-01T00:00:00.000Z'), now)).toBe(true);
    });

    it('returns false when the expiry is in the future', () => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      expect(isClaimExpired(new Date('2026-01-10T00:00:00.000Z'), now)).toBe(false);
    });
  });
});
