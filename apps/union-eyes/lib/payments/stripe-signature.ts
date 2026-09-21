/**
 * Stripe webhook signature verification with timestamp-freshness enforcement.
 *
 * The MAC alone does not bound replay: a captured `Stripe-Signature` header +
 * body stays cryptographically valid forever. We therefore also reject
 * timestamps outside a bounded window in EITHER direction — stale (replay) and
 * materially future-dated — matching Stripe's default tolerance.
 *
 * `now` is injectable so the freshness rule is deterministically testable.
 */
import crypto from 'crypto';

/** Reject signatures whose `t` is more than this many seconds from now (either direction). */
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

export interface VerifyStripeSignatureOptions {
  /** Current time in ms since epoch. Defaults to Date.now(). Injected in tests. */
  now?: number;
  /** Freshness window in seconds. Defaults to STRIPE_WEBHOOK_TOLERANCE_SECONDS. */
  toleranceSeconds?: number;
}

/**
 * Returns true only when the signature is well-formed, its MAC matches, AND its
 * timestamp is within tolerance of `now`. Any failure (missing/malformed `t`,
 * bad MAC, stale, or future-dated) returns false — the caller maps every
 * failure to a single opaque rejection so the reason is not leaked.
 */
export function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  options: VerifyStripeSignatureOptions = {},
): boolean {
  if (!secret) return false;

  const parts = signature.split(',').reduce(
    (acc, part) => {
      const [key, value] = part.split('=');
      if (key === 't') acc.timestamp = value;
      if (key === 'v1') acc.signatures.push(value);
      return acc;
    },
    { timestamp: '', signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // `t` must be a positive integer (Stripe sends UNIX seconds).
  const timestampSeconds = Number(parts.timestamp);
  if (!Number.isInteger(timestampSeconds) || timestampSeconds <= 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected);

  const macValid = parts.signatures.some((sig) => {
    const signatureBuffer = Buffer.from(sig);
    return (
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    );
  });
  if (!macValid) return false;

  // Freshness: reject stale (replay) AND materially future-dated timestamps.
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const tolerance = options.toleranceSeconds ?? STRIPE_WEBHOOK_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) return false;

  return true;
}
