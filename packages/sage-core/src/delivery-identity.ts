// ─── @nzila/sage-core — Phase 8A delivery identity + token cryptography ──────
// Deterministic recipient-identity binding + one-time invitation / session
// token generation. Tokens are high-entropy, URL-safe, and NEVER persisted or
// logged in plaintext — only their SHA-256 hash is stored, and equality is
// timing-safe.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { canonicalJsonStringify, sha256Hex } from './export-scope'

/** Bits of cryptographic randomness per delivery token (256 bits = 32 bytes). */
export const SAGE_DELIVERY_TOKEN_BYTES = 32

/**
 * Normalize an email for deterministic hashing: trim + lowercase. We do not
 * strip sub-addresses ("+tag") — different tagged addresses are treated as
 * distinct verified identities on purpose.
 */
export function normalizeDeliveryEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Deterministic hash of a normalized email — the only email form persisted. */
export function hashNormalizedEmail(email: string): string {
  return sha256Hex(normalizeDeliveryEmail(email))
}

/**
 * Deterministic binding hash over the TRUSTED recipient identity fields. The
 * approved identity hash changes whenever the identity provider, subject, or
 * verified email changes — approval is never bound to a mutable display name.
 */
export function hashRecipientIdentity(input: {
  identityProvider: string
  identitySubject: string
  normalizedEmailHash: string
}): string {
  return sha256Hex(
    canonicalJsonStringify({
      identityProvider: input.identityProvider,
      identitySubject: input.identitySubject,
      normalizedEmailHash: input.normalizedEmailHash,
    }),
  )
}

/**
 * Generate a one-time delivery token. Returns the URL-safe plaintext (shown to
 * the caller exactly once) and its SHA-256 hash (the only value persisted).
 */
export function generateDeliveryToken(): { token: string; tokenHash: string } {
  const token = randomBytes(SAGE_DELIVERY_TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashDeliveryToken(token) }
}

/** SHA-256 hash of a delivery token (hex). */
export function hashDeliveryToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Timing-safe comparison of two hex-encoded hashes. Returns false (never
 * throws) for malformed or mismatched-length inputs.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false
  }
  let bufA: Buffer
  let bufB: Buffer
  try {
    bufA = Buffer.from(a, 'hex')
    bufB = Buffer.from(b, 'hex')
  } catch {
    return false
  }
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return timingSafeEqual(bufA, bufB)
}

/** Verify a presented token against a stored hash, timing-safely. */
export function verifyDeliveryToken(presentedToken: string, storedHash: string): boolean {
  if (typeof presentedToken !== 'string' || presentedToken.length === 0) return false
  return timingSafeEqualHex(hashDeliveryToken(presentedToken), storedHash)
}
