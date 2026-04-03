/**
 * @nzila/platform-auth — Clerk Webhook Verification
 *
 * Centralised Svix HMAC-SHA256 signature verification for Clerk webhooks.
 * ALL apps must use this instead of inline verification to ensure
 * consistent timing-safe signature checks and timestamp validation.
 *
 * @invariant WEBHOOK_VERIFY_001 — single verification path for all apps
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface SvixHeaders {
  svixId: string
  svixTimestamp: string
  svixSignature: string
}

/**
 * Extract Svix headers from a request Headers object.
 * Returns null if any required header is missing.
 */
export function extractSvixHeaders(
  headers: Pick<Headers, 'get'>,
): SvixHeaders | null {
  const svixId = headers.get('svix-id')
  const svixTimestamp = headers.get('svix-timestamp')
  const svixSignature = headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return null
  }
  return { svixId, svixTimestamp, svixSignature }
}

/**
 * Verify a Clerk/Svix webhook signature (HMAC-SHA256, timing-safe).
 *
 * @param payload    — raw request body as string
 * @param headers    — Svix headers (id, timestamp, signature)
 * @param secret     — Clerk webhook secret (starts with `whsec_`)
 * @returns true if signature is valid
 */
export function verifySvixSignature(
  payload: string,
  headers: SvixHeaders,
  secret: string,
): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')

  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${payload}`
  const expectedSignature = createHmac('sha256', secretBytes)
    .update(toSign, 'utf8')
    .digest('base64')

  // Svix may send multiple versioned signatures separated by spaces
  const signatures = headers.svixSignature.split(' ')
  for (const versionedSig of signatures) {
    const [, sig] = versionedSig.split(',')
    if (!sig) continue
    try {
      const sigBuffer = Buffer.from(sig, 'base64')
      const expectedBuffer = Buffer.from(expectedSignature, 'base64')
      if (
        sigBuffer.length === expectedBuffer.length &&
        timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

/**
 * Validate the Svix timestamp is within tolerance (5 minutes).
 * Prevents replay attacks.
 */
export function isSvixTimestampValid(
  timestamp: string,
  toleranceSecs = 300,
): boolean {
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) return false
  const now = Math.floor(Date.now() / 1000)
  return Math.abs(now - ts) < toleranceSecs
}

/**
 * Full webhook verification: headers + timestamp + signature.
 * Returns an error message string on failure, or null on success.
 */
export function verifyClerkWebhook(
  payload: string,
  requestHeaders: Pick<Headers, 'get'>,
  secret: string,
): { verified: true } | { verified: false; reason: string } {
  const svixHeaders = extractSvixHeaders(requestHeaders)
  if (!svixHeaders) {
    return { verified: false, reason: 'Missing Svix headers' }
  }

  if (!isSvixTimestampValid(svixHeaders.svixTimestamp)) {
    return { verified: false, reason: 'Timestamp outside tolerance window' }
  }

  if (!verifySvixSignature(payload, svixHeaders, secret)) {
    return { verified: false, reason: 'Invalid signature' }
  }

  return { verified: true }
}
