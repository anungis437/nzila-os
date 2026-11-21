/**
 * QBO Token Encryption Service
 *
 * Envelope-encrypts QBO OAuth tokens before DB storage and decrypts on read.
 *
 * Strategy:
 *   - PRODUCTION:  Requires the configured local AES-256-GCM key.
 *                  Azure Key Vault wrapping is not implemented here.
 *   - DEV/TEST:    Uses QBO_TOKEN_ENCRYPTION_KEY env var (32-byte hex) as a
 *                  static DEK. Missing keys retain nonproduction plaintext compatibility.
 *
 * Encrypted tokens are stored as:  `enc:v1:<iv-hex>:<ciphertext-hex>:<tag-hex>`
 *
 * Plaintext tokens (legacy) are detected by the absence of the `enc:` prefix
 * and returned as-is during a migration window.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('qbo-token-crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
const PREFIX = 'enc:v1:'

/**
 * Resolve the 32-byte data encryption key.
 *
 * Priority:
 *   1. AZURE_KEYVAULT_URL — when set, the local DEK must still be provided
 *      via QBO_TOKEN_ENCRYPTION_KEY; full envelope encryption (KV wrapKey /
 *      unwrapKey of the DEK) is tracked separately and intentionally NOT
 *      implemented here so the surface fails closed if the key is missing.
 *   2. QBO_TOKEN_ENCRYPTION_KEY — hex-encoded 32-byte key for local dev
 *   3. null — nonproduction plaintext compatibility only
 */
function getDek(): Buffer | null {
  const localKey = process.env.QBO_TOKEN_ENCRYPTION_KEY
  if (localKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(localKey)) {
      throw new Error(
        'QBO_TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)',
      )
    }
    return Buffer.from(localKey, 'hex')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'QBO_TOKEN_ENCRYPTION_KEY is required in production to encrypt QBO OAuth tokens at rest',
    )
  }
  if (process.env.AZURE_KEYVAULT_URL) {
    logger.warn('QBO local encryption key is unavailable in this nonproduction environment')
  }
  return null
}

/** Validate storage configuration before exchanging provider credentials. */
export function assertQboTokenStorageAvailable(): void {
  getDek()
}

/**
 * Encrypt a token string. Returns ciphertext in `enc:v1:...` format.
 * Falls back to plaintext if no encryption key is available.
 */
export function encryptToken(plaintext: string): string {
  const dek = getDek()
  if (!dek) return plaintext

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, dek, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

/**
 * Decrypt a token string. Handles both encrypted (`enc:v1:...`) and
 * legacy plaintext tokens (for migration window).
 */
export function decryptToken(stored: string): string {
  // Legacy plaintext — no prefix
  if (!stored.startsWith(PREFIX)) {
    return stored
  }

  const dek = getDek()
  if (!dek) {
    throw new Error('Cannot decrypt token — no encryption key configured')
  }

  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted token')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const ciphertext = Buffer.from(parts[1], 'hex')
  const tag = Buffer.from(parts[2], 'hex')

  const decipher = createDecipheriv(ALGORITHM, dek, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString('utf8')
}
