/**
 * AES-256-GCM encryption for TOTP secrets at rest.
 *
 * Key source: `AUTH_MFA_ENCRYPTION_KEY` env var — 64 hex chars (32 bytes).
 * If unset, we derive a stable key from `AUTH_SECRET` via SHA-256 so dev/CI
 * flows work without extra setup. Production deployments MUST set an explicit
 * key to enable key rotation independently of session signing.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

function getKey(): Buffer {
  const explicit = process.env.AUTH_MFA_ENCRYPTION_KEY
  if (explicit) {
    if (!/^[0-9a-fA-F]{64}$/.test(explicit)) {
      throw new Error('AUTH_MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    }
    return Buffer.from(explicit, 'hex')
  }
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    throw new Error(
      'Cannot encrypt MFA secrets: set AUTH_MFA_ENCRYPTION_KEY or AUTH_SECRET',
    )
  }
  return createHash('sha256')
    .update('nzila-mfa-v1:' + authSecret)
    .digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: v1:<iv-hex>:<tag-hex>:<ct-hex>
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted payload format')
  }
  const ivHex = parts[1]
  const tagHex = parts[2]
  const ctHex = parts[3]
  if (!ivHex || !tagHex || !ctHex) {
    throw new Error('Invalid encrypted payload format')
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivHex, 'hex'),
  )
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ])
  return pt.toString('utf8')
}
