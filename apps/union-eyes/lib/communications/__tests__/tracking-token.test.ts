import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getCommunicationsSigningSecret,
  isCommunicationsSigningConfigured,
  signTrackingPayload,
  verifyTrackingToken,
} from '../tracking-token';

const ENV_KEYS = ['COMMUNICATIONS_TRACKING_SECRET', 'RESEND_TRACKING_SECRET'] as const;

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe('communications tracking-token verifier', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  describe('getCommunicationsSigningSecret', () => {
    it('prefers COMMUNICATIONS_TRACKING_SECRET over the RESEND fallback', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'primary';
      process.env.RESEND_TRACKING_SECRET = 'fallback';
      expect(getCommunicationsSigningSecret()).toBe('primary');
    });

    it('falls back to RESEND_TRACKING_SECRET when the primary is absent', () => {
      process.env.RESEND_TRACKING_SECRET = 'fallback';
      expect(getCommunicationsSigningSecret()).toBe('fallback');
    });

    it('treats empty and whitespace-only secrets as not configured', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = '   ';
      expect(getCommunicationsSigningSecret()).toBe('');
      expect(isCommunicationsSigningConfigured()).toBe(false);
    });

    it('treats placeholder secrets as not configured', () => {
      for (const placeholder of ['changeme', 'CHANGE-ME', 'placeholder', 'your-secret', 'todo']) {
        process.env.COMMUNICATIONS_TRACKING_SECRET = placeholder;
        expect(getCommunicationsSigningSecret()).toBe('');
        expect(isCommunicationsSigningConfigured()).toBe(false);
      }
    });

    it('accepts a real secret', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 's3cr3t-value';
      expect(getCommunicationsSigningSecret()).toBe('s3cr3t-value');
      expect(isCommunicationsSigningConfigured()).toBe(true);
    });
  });

  describe('verifyTrackingToken', () => {
    it('returns configuration_missing when no secret is configured (fail closed)', () => {
      const token = signTrackingPayload('anything', 'c1:r1');
      expect(verifyTrackingToken(token, ['c1:r1'])).toBe('configuration_missing');
    });

    it('returns configuration_missing when the secret is a placeholder', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'changeme';
      const token = signTrackingPayload('changeme', 'c1:r1');
      expect(verifyTrackingToken(token, ['c1:r1'])).toBe('configuration_missing');
    });

    it('returns invalid when the token is missing', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
      expect(verifyTrackingToken(null, ['c1:r1'])).toBe('invalid');
      expect(verifyTrackingToken(undefined, ['c1:r1'])).toBe('invalid');
    });

    it('returns invalid for a token signed with the wrong secret', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'right-secret';
      const token = signTrackingPayload('wrong-secret', 'c1:r1');
      expect(verifyTrackingToken(token, ['c1:r1'])).toBe('invalid');
    });

    it('returns invalid for a tampered token', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
      const token = signTrackingPayload('secret', 'c1:r1');
      const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
      expect(verifyTrackingToken(tampered, ['c1:r1'])).toBe('invalid');
    });

    it('returns invalid when the token matches a different payload than requested', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
      const token = signTrackingPayload('secret', 'c1:r1');
      expect(verifyTrackingToken(token, ['c1:r2'])).toBe('invalid');
    });

    it('returns valid for a correctly signed, action-bound token', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
      const token = signTrackingPayload('secret', 'c1:r1:unsubscribe');
      expect(verifyTrackingToken(token, ['c1:r1:unsubscribe'])).toBe('valid');
    });

    it('matches any one of several candidate payloads', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
      const token = signTrackingPayload('secret', 'c1:r1:msg1');
      expect(verifyTrackingToken(token, ['c1:r1', 'c1:r1:msg1'])).toBe('valid');
    });

    it('uses a constant-time comparison (length mismatch is rejected, not thrown)', () => {
      process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
      const shortToken = crypto.randomBytes(4).toString('hex');
      expect(verifyTrackingToken(shortToken, ['c1:r1'])).toBe('invalid');
    });
  });
});
