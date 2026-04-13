/**
 * @nzila/platform-integrations — Signature Utilities
 *
 * HMAC signature computation and verification for webhook security.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type SignatureAlgorithm = 'hmac-sha256' | 'hmac-sha512'

/**
 * Compute an HMAC signature for outbound webhooks.
 */
export function computeHmacSignature(
  body: string,
  secret: string,
  algorithm: SignatureAlgorithm = 'hmac-sha256',
): string {
  const hashAlgo = algorithm === 'hmac-sha512' ? 'sha512' : 'sha256'
  const signature = createHmac(hashAlgo, secret).update(body).digest('hex')
  return `${hashAlgo}=${signature}`
}

/**
 * Verify an HMAC signature for inbound webhooks.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyHmacSignature(
  body: string,
  secret: string,
  providedSignature: string,
  algorithm: SignatureAlgorithm = 'hmac-sha256',
): boolean {
  const expected = computeHmacSignature(body, secret, algorithm)

  // Timing-safe comparison
  if (expected.length !== providedSignature.length) return false

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf-8'),
      Buffer.from(providedSignature, 'utf-8'),
    )
  } catch {
    return false
  }
}
