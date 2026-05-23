import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createLogger } from '@nzila/os-core'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const PREFIX = 'enc:v1:'

const logger = createLogger('integrations-secret-crypto')

function getDek(): Buffer | null {
  const keyHex = process.env.INTEGRATION_SECRET_ENCRYPTION_KEY ?? process.env.QBO_TOKEN_ENCRYPTION_KEY
  if (!keyHex) return null
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) return null
  return key
}

export function encryptSecrets(secrets: Record<string, string>): string {
  const plaintext = JSON.stringify(secrets)
  const dek = getDek()
  if (!dek) {
    if (process.env.NODE_ENV === 'production') {
      // Fail-closed: silently storing integration credentials (OAuth tokens,
      // API keys, webhook secrets) as plaintext JSON in the DB is unacceptable
      // in production. Anyone with DB read access could pivot to upstream SaaS.
      logger.error(
        'Refusing to persist integration secrets in plaintext — set INTEGRATION_SECRET_ENCRYPTION_KEY (or QBO_TOKEN_ENCRYPTION_KEY) to a 64-char hex key',
      )
      throw new Error(
        'INTEGRATION_SECRET_ENCRYPTION_KEY is required in production to encrypt integration secrets at rest',
      )
    }
    logger.warn('integration secrets stored in plaintext (no encryption key configured — dev/test only)')
    return plaintext
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, dek, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

export function decryptSecrets(stored: string): Record<string, string> {
  if (!stored.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => typeof value === 'string') as Array<[string, string]>,
      )
    } catch {
      return {}
    }
  }

  const dek = getDek()
  if (!dek) {
    throw new Error('Integration secret decryption key is not configured')
  }

  const parts = stored.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed integration secret payload')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const ciphertext = Buffer.from(parts[1], 'hex')
  const tag = Buffer.from(parts[2], 'hex')

  const decipher = createDecipheriv(ALGORITHM, dek, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const parsed = JSON.parse(decrypted.toString('utf8')) as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => typeof value === 'string') as Array<[string, string]>,
  )
}

export function secretsFingerprint(secrets: Record<string, string>): string {
  const canonical = JSON.stringify(
    Object.keys(secrets)
      .sort()
      .reduce<Record<string, string>>((acc, key) => {
        acc[key] = secrets[key]
        return acc
      }, {}),
  )
  return createHash('sha256').update(canonical).digest('hex')
}
