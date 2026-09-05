import { describe, expect, it } from 'vitest';
import {
  generateCapabilityToken,
  hashCapabilityToken,
  computeCapabilityExpiry,
  isCapabilityExpired,
  extractCapabilityToken,
  checkCapability,
  capabilityDenialStatus,
  decodeCapabilityCookieValue,
  capabilityCookieName,
} from '../assessment-capability';

describe('lib/icra/assessment-capability', () => {
  it('generates sufficiently long, unique random tokens', () => {
    const a = generateCapabilityToken();
    const b = generateCapabilityToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it('hashes deterministically (same token -> same hash)', () => {
    const token = 'fixed-token-value';
    expect(hashCapabilityToken(token)).toBe(hashCapabilityToken(token));
  });

  it('never returns the raw token from the hash', () => {
    const token = 'fixed-token-value';
    expect(hashCapabilityToken(token)).not.toContain(token);
  });

  it('computeCapabilityExpiry adds the configured TTL', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const expiry = computeCapabilityExpiry(now);
    expect(expiry.getTime()).toBeGreaterThan(now.getTime());
  });

  it('isCapabilityExpired treats a missing expiry as expired (fail closed)', () => {
    expect(isCapabilityExpired(null)).toBe(true);
    expect(isCapabilityExpired(undefined)).toBe(true);
  });

  it('isCapabilityExpired treats the exact expiry instant as expired (<=, not <)', () => {
    const now = new Date('2026-01-15T00:00:00.000Z');
    expect(isCapabilityExpired(now, now)).toBe(true);
  });

  it('isCapabilityExpired compares against the provided "now"', () => {
    const now = new Date('2026-01-15T00:00:00.000Z');
    expect(isCapabilityExpired(new Date('2026-01-14T00:00:00.000Z'), now)).toBe(true);
    expect(isCapabilityExpired(new Date('2026-01-16T00:00:00.000Z'), now)).toBe(false);
  });

  it('extractCapabilityToken prefers the Authorization header over the cookie', () => {
    const req = new Request('http://localhost', {
      headers: {
        authorization: 'Bearer header-token',
        cookie: 'icra_cap_a1=cookie-token',
      },
    });
    expect(extractCapabilityToken(req, 'a1')).toBe('header-token');
  });

  it('extractCapabilityToken falls back to the per-assessment cookie', () => {
    const req = new Request('http://localhost', {
      headers: { cookie: 'other=1; icra_cap_a1=cookie-token; another=2' },
    });
    expect(extractCapabilityToken(req, 'a1')).toBe('cookie-token');
  });

  it('extractCapabilityToken does not read a different assessment\'s cookie', () => {
    const req = new Request('http://localhost', {
      headers: { cookie: 'icra_cap_a2=cookie-token' },
    });
    expect(extractCapabilityToken(req, 'a1')).toBeNull();
  });

  it('extractCapabilityToken returns null when nothing is presented', () => {
    const req = new Request('http://localhost');
    expect(extractCapabilityToken(req, 'a1')).toBeNull();
  });

  it('extractCapabilityToken treats a malformed percent-encoded cookie as absent, never throws', () => {
    const req = new Request('http://localhost', {
      headers: { cookie: 'icra_cap_a1=%E0%A4%A' }, // truncated/invalid UTF-8 escape
    });
    expect(() => extractCapabilityToken(req, 'a1')).not.toThrow();
    expect(extractCapabilityToken(req, 'a1')).toBeNull();
  });

  it('decodeCapabilityCookieValue treats a malformed value as absent, never throws (Server Component path)', () => {
    expect(() => decodeCapabilityCookieValue('%')).not.toThrow();
    expect(decodeCapabilityCookieValue('%')).toBeNull();
    expect(decodeCapabilityCookieValue(undefined)).toBeNull();
    expect(decodeCapabilityCookieValue(null)).toBeNull();
  });

  it('decodeCapabilityCookieValue decodes a well-formed value', () => {
    expect(decodeCapabilityCookieValue(encodeURIComponent('a-real-token'))).toBe('a-real-token');
  });

  it('capabilityCookieName is stable and per-assessment', () => {
    expect(capabilityCookieName('a1')).toBe('icra_cap_a1');
    expect(capabilityCookieName('a1')).not.toBe(capabilityCookieName('a2'));
  });

  it('checkCapability denies with not_found when the row is missing', () => {
    const result = checkCapability('any-token', undefined);
    expect(result).toEqual({ ok: false, reason: 'not_found' });
  });

  it('checkCapability denies with missing when no token is presented', () => {
    const result = checkCapability(null, {
      capabilityTokenHash: hashCapabilityToken('t'),
      capabilityTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('checkCapability denies with invalid when no hash was ever issued', () => {
    const result = checkCapability('any-token', {
      capabilityTokenHash: null,
      capabilityTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('checkCapability denies with expired when past the expiry', () => {
    const token = 'valid-token';
    const result = checkCapability(token, {
      capabilityTokenHash: hashCapabilityToken(token),
      capabilityTokenExpiresAt: new Date(Date.now() - 1000),
    });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('checkCapability denies with invalid on a wrong token (cross-assessment token reuse)', () => {
    const result = checkCapability('wrong-token', {
      capabilityTokenHash: hashCapabilityToken('correct-token'),
      capabilityTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('checkCapability denies with invalid on a malformed/truncated token', () => {
    const result = checkCapability('x', {
      capabilityTokenHash: hashCapabilityToken('correct-token'),
      capabilityTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('checkCapability allows a matching, unexpired token', () => {
    const token = 'valid-token';
    const result = checkCapability(token, {
      capabilityTokenHash: hashCapabilityToken(token),
      capabilityTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    expect(result).toEqual({ ok: true });
  });

  it('capabilityDenialStatus maps reasons to the expected HTTP status codes', () => {
    expect(capabilityDenialStatus('not_found')).toBe(404);
    expect(capabilityDenialStatus('expired')).toBe(410);
    expect(capabilityDenialStatus('missing')).toBe(401);
    expect(capabilityDenialStatus('invalid')).toBe(401);
  });
});
