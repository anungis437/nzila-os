/**
 * ARTIFACT TYPE: Utility
 * DOCTRINE_VERSION: 1.0.0
 *
 * Opaque claim tokens for pseudonymous artifacts (ICRA reports + Workbooks)
 * after payment. The token is the bearer credential the buyer presents on
 * the claim landing page to bind a pseudonymous record to an authenticated
 * Nzila identity (user + organization).
 *
 * Tokens are:
 *   - 32 bytes of cryptographic randomness, base64url-encoded
 *   - single-use (verify, then null the column on success)
 *   - time-bounded by an explicit `expiresAt` column on the record
 *
 * Anti-surveillance: tokens carry no identifying information; they are
 * opaque pointers.
 */

import crypto from 'crypto';

const TOKEN_BYTE_LENGTH = 32;
export const CLAIM_TOKEN_TTL_DAYS = 30;

export function generateClaimToken(): string {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('base64url');
}

export function computeClaimExpiry(now: Date = new Date()): Date {
  const expires = new Date(now);
  expires.setUTCDate(expires.getUTCDate() + CLAIM_TOKEN_TTL_DAYS);
  return expires;
}

export function isClaimExpired(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() < now.getTime();
}
