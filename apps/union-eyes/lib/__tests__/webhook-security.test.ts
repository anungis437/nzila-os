/**
 * Tests for webhook-security.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    }),
  },
}));

import {
  verifySignature,
  isWithinTimeTolerance,
  isIPWhitelisted,
  getClientIP,
  validateWebhook,
  withWebhookValidation,
  whopWebhookConfig,
  stripeWebhookConfig,
} from '../webhook-security';
import type { WebhookConfig } from '../webhook-security';

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

  describe('validateWebhook', () => {
    const secret = 'webhook-test-secret';

    function makeConfig(overrides?: Partial<WebhookConfig>): WebhookConfig {
      return {
        secret,
        signatureHeader: 'x-signature',
        ...overrides,
      };
    }

    function signPayload(payload: string, s = secret): string {
      return createHmac('sha256', s).update(payload).digest('hex');
    }

    it('returns valid for correct signature', async () => {
      const payload = '{"event":"test"}';
      const sig = signPayload(payload);
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': sig },
      });

      const result = await validateWebhook(req, makeConfig());
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload).toBe(payload);
      }
    });

    it('rejects missing signature', async () => {
      const req = new Request('http://test.com', {
        method: 'POST',
        body: '{}',
      });

      const result = await validateWebhook(req, makeConfig());
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(401);
        expect(result.response.body).toEqual(
          expect.objectContaining({ code: 'MISSING_SIGNATURE' })
        );
      }
    });

    it('rejects invalid signature', async () => {
      const req = new Request('http://test.com', {
        method: 'POST',
        body: 'data',
        headers: { 'x-signature': 'bad-sig' },
      });

      const result = await validateWebhook(req, makeConfig());
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(401);
        expect(result.response.body).toEqual(
          expect.objectContaining({ code: 'INVALID_SIGNATURE' })
        );
      }
    });

    it('rejects non-whitelisted IP', async () => {
      const payload = 'body';
      const sig = signPayload(payload);
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: {
          'x-signature': sig,
          'x-forwarded-for': '9.9.9.9',
        },
      });

      const result = await validateWebhook(
        req,
        makeConfig({ allowedIPs: ['1.2.3.4'] })
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(403);
        expect(result.response.body).toEqual(
          expect.objectContaining({ code: 'IP_NOT_WHITELISTED' })
        );
      }
    });

    it('allows whitelisted IP', async () => {
      const payload = '{"ok":true}';
      const sig = signPayload(payload);
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: {
          'x-signature': sig,
          'x-forwarded-for': '1.2.3.4',
        },
      });

      const result = await validateWebhook(
        req,
        makeConfig({ allowedIPs: ['1.2.3.4'] })
      );
      expect(result.valid).toBe(true);
    });

    it('rejects missing timestamp when required', async () => {
      const payload = 'data';
      const sig = signPayload(payload);
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': sig },
      });

      const result = await validateWebhook(
        req,
        makeConfig({
          timestampHeader: 'x-timestamp',
          timestampTolerance: 300000,
        })
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(400);
        expect(result.response.body).toEqual(
          expect.objectContaining({ code: 'MISSING_TIMESTAMP' })
        );
      }
    });

    it('rejects invalid (non-numeric) timestamp', async () => {
      const payload = 'data';
      const sig = signPayload(payload);
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': sig, 'x-timestamp': 'not-a-number' },
      });

      const result = await validateWebhook(
        req,
        makeConfig({
          timestampHeader: 'x-timestamp',
          timestampTolerance: 300000,
        })
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(400);
        expect(result.response.body).toEqual(
          expect.objectContaining({ code: 'INVALID_TIMESTAMP' })
        );
      }
    });

    it('rejects expired timestamp', async () => {
      const payload = 'data';
      const sig = signPayload(payload);
      const oldTimestamp = (Date.now() - 600_000).toString();
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': sig, 'x-timestamp': oldTimestamp },
      });

      const result = await validateWebhook(
        req,
        makeConfig({
          timestampHeader: 'x-timestamp',
          timestampTolerance: 300000,
        })
      );
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(400);
        expect(result.response.body).toEqual(
          expect.objectContaining({ code: 'TIMESTAMP_EXPIRED' })
        );
      }
    });

    it('accepts valid timestamp within tolerance', async () => {
      const payload = '{"ts":true}';
      const sig = signPayload(payload);
      const now = Date.now().toString();
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: { 'x-signature': sig, 'x-timestamp': now },
      });

      const result = await validateWebhook(
        req,
        makeConfig({
          timestampHeader: 'x-timestamp',
          timestampTolerance: 300000,
        })
      );
      expect(result.valid).toBe(true);
    });

    it('returns 500 on unexpected error', async () => {
      // Create a request where text() throws
      const badReq = new Request('http://test.com', {
        method: 'POST',
        body: 'data',
        headers: { 'x-signature': 'sig' },
      });
      // Consume the body so text() throws on second read
      await badReq.text();

      const result = await validateWebhook(badReq, makeConfig());
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.response.status).toBe(500);
      }
    });
  });

  describe('withWebhookValidation', () => {
    const secret = 'handler-secret';

    function makeConfig(): WebhookConfig {
      return { secret, signatureHeader: 'x-sig' };
    }

    it('calls handler when webhook is valid', async () => {
      const payload = '{"ok":true}';
      const sig = createHmac('sha256', secret).update(payload).digest('hex');
      const handler = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

      const wrapped = withWebhookValidation(handler, makeConfig());
      const req = new Request('http://test.com', {
        method: 'POST',
        body: payload,
        headers: { 'x-sig': sig },
      });

      const res = await wrapped(req);
      expect(handler).toHaveBeenCalledWith(payload, req);
      expect(res.status).toBe(200);
    });

    it('returns error response when webhook is invalid', async () => {
      const handler = vi.fn();

      const wrapped = withWebhookValidation(handler, makeConfig());
      const req = new Request('http://test.com', {
        method: 'POST',
        body: 'data',
        // No signature header
      });

      const res = await wrapped(req);
      expect(handler).not.toHaveBeenCalled();
      expect(res.status).toBe(401);
    });
  });

  describe('webhook config constants', () => {
    it('whopWebhookConfig has expected signature header', () => {
      expect(whopWebhookConfig.signatureHeader).toBe('x-whop-signature');
      expect(whopWebhookConfig.timestampHeader).toBe('x-whop-timestamp');
      expect(whopWebhookConfig.timestampTolerance).toBe(300000);
    });

    it('stripeWebhookConfig has expected signature header', () => {
      expect(stripeWebhookConfig.signatureHeader).toBe('stripe-signature');
    });
  });
});
