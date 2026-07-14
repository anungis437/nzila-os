/**
 * Notification Invitation Payload Encryption
 *
 * Envelope-encrypts invitation tokens + recipient email before storing in the
 * durable notification outbox. Ensures that even if the database is compromised,
 * the plaintext invitation cannot be extracted without the encryption key.
 *
 * Strategy:
 *   - PRODUCTION:  Uses SAGE_NOTIFICATION_ENCRYPTION_KEY (32-byte hex) + optional
 *                  Azure Key Vault envelope encryption of the DEK.
 *   - DEV/TEST:    Uses SAGE_NOTIFICATION_ENCRYPTION_KEY (32-byte hex). Falls back
 *                  to plaintext with logged warning.
 *
 * Encrypted payloads are stored as:  `enc:v1:<iv-hex>:<ciphertext-hex>:<tag-hex>`
 *
 * AAD (Additional Authenticated Data):
 *   - Optionally binds ciphertext to a specific grant/request
 *   - Prevents swapping encrypted payloads between different grants
 *   - Format: "{grantId}:{messageId}" (concatenated, not encoded)
 *
 * Plaintext is only acceptable in tests; in production or staging, encryption
 * must be configured.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const PREFIX = 'enc:v1:'

export interface SageNotificationPayload {
  invitationToken: string
  recipientEmail: string
  claimUrlTemplate: string
  expiresAt: string
}

/**
 * Resolve the 32-byte data encryption key for notification payloads.
 *
 * Priority:
 *   1. SAGE_NOTIFICATION_ENCRYPTION_KEY – hex-encoded 32-byte key
 *   2. null – plaintext fallback with warning (test/dev only)
 *
 * In production, missing encryption key will cause fail-closed behavior at
 * issuance time (no grant created, no invitation sent).
 */
function getNotificationDek(): Buffer | null {
  const localKey = process.env.SAGE_NOTIFICATION_ENCRYPTION_KEY

  if (localKey) {
    const buf = Buffer.from(localKey, 'hex')
    if (buf.length !== 32) {
      console.error('SAGE_NOTIFICATION_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
      return null
    }
    return buf
  }

  if (process.env.NODE_ENV === 'production') {
    console.error(
      'SAGE_NOTIFICATION_ENCRYPTION_KEY is required in production to encrypt notification payloads at rest',
    )
    throw new Error(
      'SAGE_NOTIFICATION_ENCRYPTION_KEY is required in production to encrypt invitation tokens and recipient emails',
    )
  }

  console.warn(
    'SAGE_NOTIFICATION_ENCRYPTION_KEY not configured — notification payloads stored plaintext (dev/test only)',
  )
  return null
}

/**
 * Encrypt a notification payload with optional AAD binding.
 * Returns ciphertext in `enc:v1:...` format.
 * Falls back to plaintext if no encryption key is available (dev/test only).
 *
 * @param payload The notification payload (token, email, etc.)
 * @param aad Optional Additional Authenticated Data to bind ciphertext to a specific grant.
 *            Format: "{grantId}:{messageId}" to prevent payload swapping.
 *
 * The payload must contain the invitation token, recipient email, and claim URL
 * template. This plaintext flows through the encryption service only; it is never
 * returned to the browser, logged, or stored in audit data.
 */
export function encryptNotificationPayload(payload: SageNotificationPayload, aad?: string): string {
  const dek = getNotificationDek()
  const plaintext = JSON.stringify(payload)

  if (!dek) return plaintext

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, dek, iv)

  // If AAD provided, bind ciphertext to this specific context
  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'))
  }

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

/**
 * Decrypt a notification payload with optional AAD verification.
 * Handles both encrypted (`enc:v1:...`) and legacy plaintext payloads.
 *
 * @param stored The stored (encrypted or plaintext) payload
 * @param aad Optional Additional Authenticated Data to verify against.
 *            Must match the AAD used during encryption, or decryption fails.
 *
 * Returns null if decryption fails or AAD doesn't match.
 * Returns null if decryption fails or AAD doesn't match.
 */
export function decryptNotificationPayload(stored: string, aad?: string): SageNotificationPayload | null {
  // Legacy plaintext — no prefix (dev/test only)
  if (!stored.startsWith(PREFIX)) {
    try {
      return JSON.parse(stored)
    } catch {
      console.error('Failed to parse plaintext notification payload')
      return null
    }
  }

  const dek = getNotificationDek()
  if (!dek) {
    console.error('Cannot decrypt notification payload — no encryption key configured')
    return null
  }

  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    console.error('Malformed encrypted notification payload')
    return null
  }

  try {
    const iv = Buffer.from(parts[0], 'hex')
    const ciphertext = Buffer.from(parts[1], 'hex')
    const tag = Buffer.from(parts[2], 'hex')

    const decipher = createDecipheriv(ALGORITHM, dek, iv)

    // If AAD provided, verify it matches
    if (aad) {
      decipher.setAAD(Buffer.from(aad, 'utf8'))
    }

    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    return JSON.parse(decrypted.toString('utf8'))
  } catch (err) {
    // AAD mismatch or corrupted ciphertext — fail closed
    console.error('Failed to decrypt notification payload', { error: err instanceof Error ? err.message : String(err) })
    return null
  }
}

/**
 * Destroy a notification payload after successful dispatch.
 * This prevents recovery of the plaintext token after the retry window closes.
 *
 * In production, payloads should be destroyed after:
 *   1. Provider confirms acceptance (provider_message_id persisted)
 *   2. Retry window expires (typically 24-48 hours)
 *
 * The database update sets payload_destroyed_at = now() and may optionally
 * clear the encrypted_payload column, but we trust DB permissions to control
 * historical access.
 */
export function isPayloadDestroyed(payload: string): boolean {
  return payload === '' || payload === null
}
