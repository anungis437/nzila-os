/**
 * Tests for webhook-security.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  verifySignature,
  isWithinTimeTolerance,
  isIPWhitelisted,
  getClientIP,
} from '../webhook-security';

describe('webhook-security', () => {
  describe('verifySignature', () => {
    it('returns true for valid HMAC-SHA256 signature', () => {
      const secret = 'my-webhook-secret';
      const payload = '{"event":"test"}';
      const expected = createHmac('sha256', secret).update(payload).digest('hex');

      expect(verifySignature(payload, expected, secret, 'sha256')).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(verifySignature('payload', 'bad-sig', 'secret', 'sha256')).toBe(false);
    });

    it('returns false for wrong secret', () => {
      const payload = 'test';
      const sig = createHmac('sha256', 'correct').update(payload).digest('hex');
      expect(verifySignature(payload, sig, 'wrong-secret', 'sha256')).toBe(false);
    });

    it('supports sha1 algorithm', () => {
      const secret = 'secret';
      const payload = 'data';
      const sig = createHmac('sha1', secret).update(payload).digest('hex');
      expect(verifySignature(payload, sig, secret, 'sha1')).toBe(true);
    });
  });

  describe('isWithinTimeTolerance', () => {
    it('returns true for current timestamp', () => {
      expect(isWithinTimeTolerance(Date.now())).toBe(true);
    });

    it('returns true within tolerance', () => {
      expect(isWithinTimeTolerance(Date.now() - 60000, 300000)).toBe(true);
    });

    it('returns false for timestamp beyond tolerance', () => {
      const tenMinutesAgo = Date.now() - 600_000;
      expect(isWithinTimeTolerance(tenMinutesAgo, 300000)).toBe(false);
    });

    it('returns false for future timestamp beyond tolerance', () => {
      const tenMinutesAhead = Date.now() + 600_000;
      expect(isWithinTimeTolerance(tenMinutesAhead, 300000)).toBe(false);
    });
  });

  describe('isIPWhitelisted', () => {
    const allowedIPs = ['1.2.3.4', '10.0.0.1'];

    it('returns true for whitelisted IP', () => {
      expect(isIPWhitelisted('1.2.3.4', allowedIPs)).toBe(true);
    });

    it('returns false for non-whitelisted IP', () => {
      expect(isIPWhitelisted('9.9.9.9', allowedIPs)).toBe(false);
    });

    it('returns false for null IP', () => {
      expect(isIPWhitelisted(null, allowedIPs)).toBe(false);
    });
  });

  describe('getClientIP', () => {
    it('extracts IP from x-forwarded-for', () => {
      const req = new Request('http://test.com', {
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      });
      expect(getClientIP(req)).toBe('1.2.3.4');
    });

    it('extracts IP from x-real-ip', () => {
      const req = new Request('http://test.com', {
        headers: { 'x-real-ip': '10.0.0.1' },
      });
      expect(getClientIP(req)).toBe('10.0.0.1');
    });

    it('extracts IP from cf-connecting-ip', () => {
      const req = new Request('http://test.com', {
        headers: { 'cf-connecting-ip': '172.16.0.1' },
      });
      expect(getClientIP(req)).toBe('172.16.0.1');
    });

    it('returns null when no IP headers present', () => {
      const req = new Request('http://test.com');
      expect(getClientIP(req)).toBeNull();
    });
  });
});
