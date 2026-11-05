import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTED_PREFIX = 'enc:v1:'

// Plaintext is a test convenience only. A provider token is never written without a key, and a stored value with no encryption
// prefix is read only for the test runner or during an explicitly flagged migration of legacy rows.
const plaintextAllowedForWrite = () => process.env.NODE_ENV === 'test'
const legacyPlaintextReadable = () => process.env.NODE_ENV === 'test' || process.env.CALENDAR_TOKEN_ALLOW_LEGACY_PLAINTEXT === 'true'

function getTokenEncryptionKey(): Buffer {
  const key = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || process.env.FALLBACK_ENCRYPTION_KEY || ''

  if (!key) {
    if (!plaintextAllowedForWrite()) {
      throw new Error('Missing CALENDAR_TOKEN_ENCRYPTION_KEY (or FALLBACK_ENCRYPTION_KEY)')
    }

    return Buffer.alloc(0)
  }

  const keyBuffer = Buffer.from(key, 'hex')
  if (keyBuffer.length !== 32) {
    throw new Error('Calendar token encryption key must be a 32-byte hex string')
  }

  return keyBuffer
}

export function encryptCalendarToken(token: string): string {
  if (!token) return token

  const key = getTokenEncryptionKey()
  if (key.length === 0) {
    return token
  }

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptCalendarToken(token: string | null | undefined): string {
  if (!token) return ''

  if (!token.startsWith(ENCRYPTED_PREFIX)) {
    if (!legacyPlaintextReadable()) {
      throw new Error('Calendar token is stored unencrypted and must be re-authorized')
    }
    return token
  }

  const key = getTokenEncryptionKey()
  if (key.length === 0) {
    throw new Error('Cannot decrypt calendar token without encryption key')
  }

  const payload = token.slice(ENCRYPTED_PREFIX.length)
  const [ivRaw, tagRaw, ciphertextRaw] = payload.split('.')

  if (!ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error('Invalid encrypted calendar token format')
  }

  const iv = Buffer.from(ivRaw, 'base64url')
  const authTag = Buffer.from(tagRaw, 'base64url')
  const ciphertext = Buffer.from(ciphertextRaw, 'base64url')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

  return decrypted.toString('utf8')
}
