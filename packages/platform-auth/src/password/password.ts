/**
 * Password Service — Argon2id hashing & verification
 *
 * Uses Argon2id (OWASP recommended) for password hashing.
 * All operations are constant-time to prevent timing attacks.
 *
 * Shared across all Nzila apps via @nzila/platform-auth/password.
 */
import argon2 from 'argon2'

// Argon2id parameters — OWASP recommended minimums
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB (OWASP minimum for argon2id)
  timeCost: 2, // 2 iterations
  parallelism: 1, // 1 degree of parallelism
  hashLength: 32, // 32-byte output
}

/**
 * Hash a plaintext password using Argon2id.
 * Returns a PHC-format string that includes salt + params.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

/**
 * Verify a plaintext password against a stored Argon2id hash.
 * Constant-time comparison to prevent timing side-channels.
 */
export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    // Malformed hash or other errors → treat as non-match
    return false
  }
}

/**
 * Check if a hash needs re-hashing (e.g. after parameter upgrades).
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS)
}

// ─── Password Policy ───────────────────────────────────────────────────────

const MIN_LENGTH = 8
const MAX_LENGTH = 128

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a password against the platform password policy.
 * Returns { valid: true } or { valid: false, errors: [...] }
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []

  if (password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`)
  }
  if (password.length > MAX_LENGTH) {
    errors.push(`Password must be at most ${MAX_LENGTH} characters`)
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit')
  }

  return { valid: errors.length === 0, errors }
}
