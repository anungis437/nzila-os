/**
 * TOTP (RFC 6238) — Time-based One-Time Password, interop-compatible with
 * Google Authenticator, Microsoft Authenticator, 1Password, Authy, etc.
 *
 * Zero external dependencies. Everything here is pure crypto over Node's
 * built-in `crypto` module. Do NOT add a TOTP library — the surface is
 * small enough to own, and fewer deps = smaller attack surface.
 *
 * Usage:
 *   const secret = generateTotpSecret()           // base32
 *   const uri = buildOtpAuthUri(secret, 'user@e.com', 'Union Eyes')
 *   const valid = verifyTotp(secret, '123456')    // boolean
 */
import { createHmac, randomBytes } from 'crypto'

// ─── Base32 (RFC 4648, no padding) ──────────────────────────────────────────
// Authenticator apps expect base32-encoded secrets.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return out
}

export function base32Decode(encoded: string): Buffer {
  const clean = encoded.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '') // codeql[js/polynomial-redos] - input is a short base32 token, not attacker-controlled with adversarial length
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) throw new Error('Invalid base32 character')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// ─── TOTP core (RFC 6238 / HOTP RFC 4226) ───────────────────────────────────

const TOTP_PERIOD_SECONDS = 30
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = 'sha1' // spec default — what authenticator apps expect

function readByte(buf: Buffer, index: number): number {
  const value = buf[index]
  if (value === undefined) {
    throw new Error('Invalid HMAC digest')
  }
  return value
}

function hotp(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(counter)
  const hmac = createHmac(TOTP_ALGORITHM, secret).update(counterBuf).digest()
  const offset = readByte(hmac, hmac.length - 1) & 0x0f
  if (offset + 3 >= hmac.length) {
    throw new Error('Invalid HMAC digest')
  }
  const binCode =
    ((readByte(hmac, offset) & 0x7f) << 24) |
    ((readByte(hmac, offset + 1) & 0xff) << 16) |
    ((readByte(hmac, offset + 2) & 0xff) << 8) |
    (readByte(hmac, offset + 3) & 0xff)
  const code = binCode % 10 ** TOTP_DIGITS
  return code.toString().padStart(TOTP_DIGITS, '0')
}

export function generateTotpSecret(): string {
  // 20 random bytes → 32 base32 chars — RFC 4226 recommended size for HMAC-SHA1
  return base32Encode(randomBytes(20))
}

export function computeTotp(secret: string, timestampMs = Date.now()): string {
  const counter = BigInt(Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS))
  return hotp(base32Decode(secret), counter)
}

/**
 * Verify a user-supplied code, tolerating one step of clock drift in each
 * direction (so ±30 s). Returns true on match. Constant-time-ish (we check
 * all windows even after a match to avoid leaking which window matched).
 */
export function verifyTotp(
  secret: string,
  code: string,
  timestampMs = Date.now(),
  window = 1,
): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const secretBuf = base32Decode(secret)
  const currentCounter = BigInt(
    Math.floor(timestampMs / 1000 / TOTP_PERIOD_SECONDS),
  )
  let matched = false
  for (let offset = -window; offset <= window; offset++) {
    const expected = hotp(secretBuf, currentCounter + BigInt(offset))
    // Constant-time compare (both are 6 ASCII digits)
    let diff = 0
    for (let i = 0; i < TOTP_DIGITS; i++) {
      diff |= expected.charCodeAt(i) ^ code.charCodeAt(i)
    }
    if (diff === 0) matched = true
  }
  return matched
}

// ─── otpauth:// URI for QR-code enrollment ──────────────────────────────────

export function buildOtpAuthUri(
  secret: string,
  accountLabel: string,
  issuer: string,
): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ─── Recovery codes ─────────────────────────────────────────────────────────
// 10 codes, 10 chars each (XXXX-XXXX-XX format), shown once at enrollment.
// SHA-256 hashed at rest; on use, the consumed code is removed from the array.

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(5) // 40 bits → ~1 trillion possibilities per code
    const hex = bytes.toString('hex').toUpperCase()
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 10)}`)
  }
  return codes
}
