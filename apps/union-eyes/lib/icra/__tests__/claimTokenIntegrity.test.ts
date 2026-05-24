/**
 * ARTIFACT TYPE: Vitest Suite — P1 OCRA Hardening
 * MODULE: OCI Operational Truth Hardening — Part 3
 * DOCTRINE_VERSION: 1.0.0
 *
 * Claim token integrity: tokens must be unique, opaque, and TTL-bounded.
 */

import { describe, expect, it } from 'vitest';

import {
  generateClaimToken,
  computeClaimExpiry,
  isClaimExpired,
  CLAIM_TOKEN_TTL_DAYS,
} from '../claim-tokens';

describe('OCRA claim token integrity', () => {
  it('a generated token is a non-empty string', () => {
    const t = generateClaimToken();
    expect(typeof t).toBe('string');
    expect(t.length).toBeGreaterThan(20);
  });

  it('1000 tokens generated in a tight loop are all distinct', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateClaimToken());
    }
    expect(tokens.size).toBe(1000);
  });

  it('the expiry is exactly CLAIM_TOKEN_TTL_DAYS after the supplied now', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeClaimExpiry(now);
    const delta = expiry.getTime() - now.getTime();
    expect(delta).toBe(CLAIM_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  });

  it('isClaimExpired is false at the boundary now < expiry', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeClaimExpiry(now);
    expect(isClaimExpired(expiry, now)).toBe(false);
  });

  it('isClaimExpired is true once now is past expiry', () => {
    const issuedAt = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeClaimExpiry(issuedAt);
    const future = new Date(expiry.getTime() + 1);
    expect(isClaimExpired(expiry, future)).toBe(true);
  });

  it('the TTL is at least 7 days (organizational review windows)', () => {
    expect(CLAIM_TOKEN_TTL_DAYS).toBeGreaterThanOrEqual(7);
  });
});
