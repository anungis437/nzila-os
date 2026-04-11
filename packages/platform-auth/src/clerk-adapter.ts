/**
 * @nzila/platform-auth — Auth Adapter
 *
 * Maps auth provider responses behind platform types.
 * All apps should use this adapter for auth resolution.
 */
import type { AuthenticatedIdentity, AuthResult, OrgMembership } from './identity'

// ── Types for Auth Response ─────────────────────────────────────────────

interface LegacyAuthResult {
  userId: string | null
  orgId?: string | null
  orgRole?: string | null
  sessionClaims?: Record<string, unknown> | null
}

interface LegacyAuthUser {
  primaryEmailAddress?: { emailAddress: string } | null
  emailAddresses?: Array<{ emailAddress: string }> | null
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string | null
}

// ── Adapter Functions ───────────────────────────────────────────────────────

/**
 * Resolve an AuthenticatedIdentity from auth state.
 *
 * @param authResult — Result of `await auth()`
 * @param user — Result of `await currentUser()` (optional, for profile data)
 */
export function resolveIdentity(
  authResult: LegacyAuthResult,
  user?: LegacyAuthUser | null,
): AuthResult {
  if (!authResult.userId) {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
      httpStatus: 401,
    }
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    undefined

  const displayName = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .join(' ') || email || authResult.userId

  const identity: AuthenticatedIdentity = {
    userId: authResult.userId,
    email,
    displayName,
    avatarUrl: user?.imageUrl ?? undefined,
    activeOrgId: authResult.orgId ?? undefined,
    orgRole: authResult.orgRole ?? undefined,
    sessionClaims: authResult.sessionClaims ?? undefined,
    isService: false,
  }

  return { ok: true, identity }
}

/**
 * Resolve an AuthenticatedIdentity from a service-to-service key.
 *
 * @param authHeader — Authorization header value
 * @param expectedKey — The expected service key
 */
export function resolveServiceIdentity(
  authHeader: string | null,
  expectedKey: string,
): AuthResult | null {
  if (!authHeader || !expectedKey) return null
  if (authHeader !== `Bearer ${expectedKey}`) return null

  return {
    ok: true,
    identity: {
      userId: 'svc:platform',
      isService: true,
      activeOrgId: undefined,
      orgRole: undefined,
      sessionClaims: undefined,
    },
  }
}

/**
 * Map an org role string to canonical role.
 */
export function mapOrgRole(
  orgRole: string | undefined | null,
): OrgMembership['role'] {
  switch (orgRole) {
    case 'org:admin':
      return 'org_admin'
    case 'org:secretary':
      return 'org_secretary'
    case 'org:member':
    default:
      return 'org_viewer'
  }
}

/** @deprecated Use `resolveIdentity` instead */
export const resolveIdentityFromClerk = resolveIdentity

/** @deprecated Use `mapOrgRole` instead */
export const mapClerkOrgRole = mapOrgRole
