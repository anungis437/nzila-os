import crypto from 'crypto';

/**
 * Canonical fail-closed verifier for communications tracking / unsubscribe tokens.
 *
 * Security contract (COMMUNICATIONS_SECRET_FAIL_CLOSED):
 * - A missing, empty, whitespace-only, or obvious-placeholder signing secret is
 *   treated as CONFIGURATION_MISSING and MUST NOT authorize any recipient-specific
 *   analytics mutation, unsubscribe mutation, preference mutation, or an
 *   attacker-controlled redirect.
 * - A missing or non-matching token is INVALID and never authorizes a mutation.
 * - Only a token whose HMAC-SHA256 signature matches one of the supplied,
 *   action-bound candidate payloads (compared with crypto.timingSafeEqual) is VALID.
 *
 * Callers decide the surface-appropriate neutral response for the non-VALID
 * outcomes (e.g. serve the tracking pixel without recording, reject a click link,
 * or 401 an unsubscribe attempt) — but they must never mutate on a non-VALID result.
 */
export type TrackingTokenResult = 'valid' | 'invalid' | 'configuration_missing';

/**
 * Values that must never count as a configured production secret. Deliberately
 * conservative: it excludes short test values actually used by the suites
 * (e.g. "secret", "secret_1") so we do not reject a legitimately short secret,
 * while still refusing the canonical placeholder strings a misconfigured
 * deployment is likely to ship with.
 */
const PLACEHOLDER_SECRETS = new Set([
  'changeme',
  'change-me',
  'change_me',
  'placeholder',
  'your-secret',
  'your_secret',
  'your-secret-here',
  'replace-me',
  'replace_me',
  'todo',
  'example',
  'xxxxxxxx',
]);

/**
 * Resolve the canonical communications signing secret.
 *
 * COMMUNICATIONS_SIGNING_SECRET_SOURCE: COMMUNICATIONS_TRACKING_SECRET is the
 * primary variable; RESEND_TRACKING_SECRET is retained as a backward-compatible
 * fallback for deployments provisioned before the rename. Empty, whitespace-only,
 * and placeholder values resolve to '' (i.e. "not configured").
 */
export function getCommunicationsSigningSecret(): string {
  const raw = process.env.COMMUNICATIONS_TRACKING_SECRET ?? process.env.RESEND_TRACKING_SECRET ?? '';
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (PLACEHOLDER_SECRETS.has(trimmed.toLowerCase())) {
    return '';
  }
  return trimmed;
}

export function isCommunicationsSigningConfigured(): boolean {
  return getCommunicationsSigningSecret().length > 0;
}

export function signTrackingPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a tracking/unsubscribe token against a set of action-bound candidate
 * payloads. Returns a three-state outcome so callers can distinguish a
 * misconfiguration from a forged/absent token while still failing closed for both.
 */
export function verifyTrackingToken(
  token: string | null | undefined,
  candidates: string[],
): TrackingTokenResult {
  const secret = getCommunicationsSigningSecret();
  if (!secret) {
    return 'configuration_missing';
  }
  if (!token) {
    return 'invalid';
  }

  const tokenBuffer = Buffer.from(token, 'utf8');
  const matched = candidates.some((candidate) => {
    const expected = signTrackingPayload(secret, candidate);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  });

  return matched ? 'valid' : 'invalid';
}
