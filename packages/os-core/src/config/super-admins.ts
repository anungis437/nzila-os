/**
 * @nzila/os-core — Super-Admin Email Registry
 *
 * Single source of truth for super-admin emails across all apps.
 * Emails are validated at startup (RFC 5322 basic check) and
 * lowercased for case-insensitive comparison.
 *
 * Usage:
 *   import { isSuperAdmin } from '@nzila/os-core/config/super-admins'
 *
 *   if (isSuperAdmin(email)) { ... }
 *
 * Enforcement: tooling/contract-tests/dashboard-no-hardcode.test.ts
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Parse and validate the SUPER_ADMIN_EMAILS env var.
 * Returns a Set of lowercased, validated email addresses.
 */
function buildSuperAdminSet(): Set<string> {
  const builtin = ['info@nzilaventures.com', 'support@onelabtech.com']
  const envRaw = process.env.SUPER_ADMIN_EMAILS ?? ''
  const candidates = [
    ...builtin,
    ...envRaw.split(',').map(s => s.trim()).filter(Boolean),
  ]

  const validated = new Set<string>()
  for (const email of candidates) {
    const lower = email.toLowerCase()
    if (!EMAIL_RE.test(lower)) {
      console.warn(
        `[os-core] Invalid SUPER_ADMIN_EMAILS entry ignored: "${email}"`,
      )
      continue
    }
    validated.add(lower)
  }

  if (validated.size === 0) {
    throw new Error(
      '[os-core] SUPER_ADMIN_EMAILS resolved to zero valid entries — at least one super-admin email is required.',
    )
  }

  return validated
}

/** Lazily initialised so env vars are available at call time, not import time. */
let _cache: Set<string> | undefined

function getSuperAdmins(): Set<string> {
  if (!_cache) _cache = buildSuperAdminSet()
  return _cache
}

/** Check if the given email is a super-admin. Case-insensitive. */
export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return getSuperAdmins().has(email.toLowerCase())
}

/** Exposed for tests only — resets the lazy cache so env changes take effect. */
export function _resetSuperAdminCache(): void {
  _cache = undefined
}
