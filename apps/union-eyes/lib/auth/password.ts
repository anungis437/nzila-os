/**
 * Password Service — re-exports from shared @nzila/platform-auth package.
 * All Nzila apps share the same Argon2id password hashing implementation.
 */
export {
  hashPassword,
  verifyPassword,
  needsRehash,
  validatePassword,
  type PasswordValidationResult,
} from '@nzila/platform-auth/password'
