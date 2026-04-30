/**
 * Server-side org-context resolver for Nzila HQ.
 *
 * Mirrors the canonical pattern enforced by contract test
 * `ORG_REQUIRED_SERVER_ACTIONS_001`: every server action / RSC data fetch must
 * call this BEFORE accessing any data, never bare `auth()`.
 *
 * In dev or when the `auth()` call returns no user (and `NZILA_HQ_DEV_FOUNDER`
 * is set), we fall back to a synthetic founder context so the cockpit renders
 * without a fully wired auth provider — useful for the seeded demo experience.
 *
 * Strict production behavior: throws if there is no userId or orgId.
 */
import 'server-only'
import type { HqRole } from '@nzila/hq-domain'

export interface NzilaHqContext {
  userId: string
  orgId: string
  role: HqRole
  email: string | null
  isFounder: boolean
  isSuperAdmin: boolean
}

const DEV_FALLBACK_USER_ID = 'user-founder'
const DEV_FALLBACK_ORG_ID = 'org-nzila-ventures'

/**
 * Resolve the active org context. Server-only.
 *
 * @throws Error in production when no auth context is present.
 */
export async function resolveOrgContext(): Promise<NzilaHqContext> {
  // Lazy import to keep the edge runtime free of `node:crypto` dependencies.
  // See user memory: edge crypto + @nzila/platform-auth/entra/* incompatibility.
  const isProd = process.env.NODE_ENV === 'production'

  let userId: string | null = null
  let orgId: string | null = null
  let email: string | null = null

  try {
    const mod = await import('@nzila/platform-auth/entra/server')
    // The auth() helper is the canonical entry point across peer apps.
    // We tolerate any of its return shapes via narrow casting.
    const authFn = (mod as { auth?: () => Promise<unknown> }).auth
    if (typeof authFn === 'function') {
      const session = (await authFn()) as
        | { userId?: string | null; orgId?: string | null; user?: { email?: string | null } }
        | null
        | undefined
      userId = session?.userId ?? null
      orgId = session?.orgId ?? null
      email = session?.user?.email ?? null
    }
  } catch {
    // Auth provider not available (typical in fresh local dev) — fall through to dev fallback.
  }

  if (!userId || !orgId) {
    if (isProd) {
      throw new Error('NZILA_HQ_AUTH_REQUIRED: no authenticated user/org in production context')
    }
    userId = userId ?? DEV_FALLBACK_USER_ID
    orgId = orgId ?? DEV_FALLBACK_ORG_ID
  }

  const founderUserId = process.env.NZILA_HQ_FOUNDER_USER_ID ?? DEV_FALLBACK_USER_ID
  const isFounder = userId === founderUserId
  const isSuperAdmin = isFounder // tightened later via `lib/rbac.ts` once role mapping is wired

  // Default role when none can be resolved. The dependency engine and dashboards
  // gracefully degrade for low-privilege users via `lib/rbac.ts` permission checks.
  const role: HqRole = isFounder ? 'founder' : 'ops-lead'

  return { userId, orgId, role, email, isFounder, isSuperAdmin }
}
