/**
 * Safety gates for any DB-touching staging-seed operation.
 *
 * All checks are pure functions of `process.env` so tests can stub by
 * passing an explicit env object. Every gate FAILS CLOSED — when in doubt,
 * we refuse to write.
 *
 * Non-negotiable rules enforced here:
 *   1. STAGING_SEED_ENABLED=true must be set explicitly.
 *   2. DATABASE_URL must match the staging allowlist (host or substring).
 *   3. Any host containing `prod`, `production`, `live` is rejected even
 *      if the allowlist matches — defence in depth.
 *   4. The seeded org id MUST start with `org-` and contain `staging`
 *      so the reset path can never match a real tenant.
 */

export const STAGING_ENV_FLAG = 'STAGING_SEED_ENABLED'
export const DATABASE_URL_ENV = 'DATABASE_URL'
export const URL_ALLOWLIST_ENV = 'STAGING_SEED_URL_ALLOWLIST'

/** Substrings that, if present in a DB URL host, IMMEDIATELY reject. */
const PRODUCTION_DENYLIST = ['prod', 'production', 'live', 'mainnet'] as const

/** Default allowlist substrings if `STAGING_SEED_URL_ALLOWLIST` is unset. */
const DEFAULT_ALLOWLIST = ['staging', 'localhost', '127.0.0.1', 'dev'] as const

export interface SafetyEnv {
  readonly [key: string]: string | undefined
}

export interface SafetyDecision {
  readonly allowed: boolean
  readonly reason?: string
  readonly databaseUrl?: string
  readonly hostMatched?: string
}

function getAllowlist(env: SafetyEnv): readonly string[] {
  const raw = env[URL_ALLOWLIST_ENV]?.trim()
  if (!raw) return DEFAULT_ALLOWLIST
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

function parseHost(url: string): string | null {
  try {
    // Allow non-protocol forms (e.g. "postgres://...") — URL handles those.
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Authoritative gate: returns `allowed: false` UNLESS every safety
 * precondition is satisfied. Callers MUST refuse to open a DB connection
 * when this returns `allowed: false`.
 */
export function evaluateSafety(env: SafetyEnv = process.env as SafetyEnv): SafetyDecision {
  const enabled = env[STAGING_ENV_FLAG]?.toLowerCase()
  if (enabled !== 'true' && enabled !== '1' && enabled !== 'yes') {
    return {
      allowed: false,
      reason: `${STAGING_ENV_FLAG} is not set to "true" — DB writes refused.`,
    }
  }

  const url = env[DATABASE_URL_ENV]?.trim()
  if (!url) {
    return {
      allowed: false,
      reason: `${DATABASE_URL_ENV} is not set — DB writes refused.`,
    }
  }

  const host = parseHost(url)
  if (!host) {
    return {
      allowed: false,
      reason: `${DATABASE_URL_ENV} is not a parseable URL — DB writes refused.`,
    }
  }

  for (const denied of PRODUCTION_DENYLIST) {
    if (host.includes(denied)) {
      return {
        allowed: false,
        reason: `${DATABASE_URL_ENV} host "${host}" contains denied substring "${denied}" — DB writes refused.`,
        databaseUrl: url,
      }
    }
  }

  const allowlist = getAllowlist(env)
  const matched = allowlist.find((needle) => host.includes(needle))
  if (!matched) {
    return {
      allowed: false,
      reason: `${DATABASE_URL_ENV} host "${host}" not in allowlist [${allowlist.join(', ')}].`,
      databaseUrl: url,
    }
  }

  return { allowed: true, databaseUrl: url, hostMatched: matched }
}

/**
 * Validate that an organization id is safe to delete during reset. We
 * require `org-` prefix AND `staging` substring so synthetic IDs from the
 * Phase 2 seeders (e.g. `org-ue-staging-local-9999`) always pass while
 * real tenant ids never do.
 */
export function isSafeStagingOrgId(orgId: string): boolean {
  if (typeof orgId !== 'string') return false
  if (!orgId.startsWith('org-')) return false
  if (!orgId.toLowerCase().includes('staging')) return false
  return true
}

export function assertSafeStagingOrgId(orgId: string): void {
  if (!isSafeStagingOrgId(orgId)) {
    throw new Error(
      `Refusing to operate on org id "${orgId}" — must start with "org-" and contain "staging".`,
    )
  }
}
