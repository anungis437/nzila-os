/**
 * AES-256-GCM encryption for TOTP secrets at rest.
 *
 * Key source: `AUTH_MFA_ENCRYPTION_KEY` env var — 64 hex chars (32 bytes). A deployed
 * environment (production, staging, pilot, demo) must set it: it refuses to encrypt a new
 * secret under a key derived from `AUTH_SECRET`, so MFA key rotation never depends on session
 * signing. Secrets already stored under the derived key stay readable (they authenticate under
 * that key and no other), so an environment that enrolled before the explicit key existed keeps
 * working until its users re-enrol. Outside a deployment the derived key keeps dev/CI flows
 * working without extra setup.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { isDeployedRuntime } from '../runtime-identity'

function explicitKey(): Buffer | null {
  const explicit = process.env.AUTH_MFA_ENCRYPTION_KEY
  if (!explicit) return null
  if (!/^[0-9a-fA-F]{64}$/.test(explicit)) {
    throw new Error('AUTH_MFA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
  }
  return Buffer.from(explicit, 'hex')
}

function derivedKey(): Buffer {
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

/** The key a new secret is encrypted under. */
function getKey(): Buffer {
  const explicit = explicitKey()
  if (explicit) return explicit
  if (isDeployedRuntime()) {
    throw new Error(
      'AUTH_MFA_ENCRYPTION_KEY is required in a deployed environment: MFA secrets are not encrypted under a key derived from AUTH_SECRET there',
    )
  }
  return derivedKey()
}

/** The keys a stored secret may have been encrypted under: the explicit key, then the key derived from AUTH_SECRET (secrets stored before the explicit key existed). */
function readKeys(): Buffer[] {
  const keys: Buffer[] = []
  const explicit = explicitKey()
  if (explicit) keys.push(explicit)
  if (process.env.AUTH_SECRET) keys.push(derivedKey())
  if (keys.length === 0) derivedKey()
  return keys
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
  let failure: unknown
  for (const key of readKeys()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
      const pt = Buffer.concat([
        decipher.update(Buffer.from(ctHex, 'hex')),
        decipher.final(),
      ])
      return pt.toString('utf8')
    } catch (error) {
      failure = error
    }
  }
  throw failure
}
