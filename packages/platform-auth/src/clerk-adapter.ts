/**
 * @nzila/platform-auth — Clerk Adapter
 *
 * Wraps Clerk-specific auth calls behind platform types.
 * All apps should use this adapter instead of importing
 * @clerk/nextjs directly for auth resolution.
 *
 * This adapter can be swapped if the auth provider changes.
 */
import type { AuthenticatedIdentity, AuthResult, OrgMembership } from './identity'

// ── Types for Clerk Auth Response ───────────────────────────────────────────

interface ClerkAuthResult {
  userId: string | null
  orgId?: string | null
  orgRole?: string | null
  sessionClaims?: Record<string, unknown> | null
}

interface ClerkUser {
  primaryEmailAddress?: { emailAddress: string } | null
  emailAddresses?: Array<{ emailAddress: string }> | null
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string | null
}

// ── Adapter Functions ───────────────────────────────────────────────────────

/**
 * Resolve an AuthenticatedIdentity from Clerk auth state.
 *
 * @param clerkAuth — Result of `await auth()` from @clerk/nextjs/server
 * @param clerkUser — Result of `await currentUser()` (optional, for profile data)
 */
export function resolveIdentityFromClerk(
  clerkAuth: ClerkAuthResult,
  clerkUser?: ClerkUser | null,
): AuthResult {
  if (!clerkAuth.userId) {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
      httpStatus: 401,
    }
  }

  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ??
    clerkUser?.emailAddresses?.[0]?.emailAddress ??
    undefined

  const displayName = [clerkUser?.firstName, clerkUser?.lastName]
    .filter(Boolean)
    .join(' ') || email || clerkAuth.userId

  const identity: AuthenticatedIdentity = {
    userId: clerkAuth.userId,
    email,
    displayName,
    avatarUrl: clerkUser?.imageUrl ?? undefined,
    activeOrgId: clerkAuth.orgId ?? undefined,
    orgRole: clerkAuth.orgRole ?? undefined,
    sessionClaims: clerkAuth.sessionClaims ?? undefined,
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
 * Map a Clerk org role string to canonical role.
 */
export function mapClerkOrgRole(
  clerkOrgRole: string | undefined | null,
): OrgMembership['role'] {
  switch (clerkOrgRole) {
    case 'org:admin':
      return 'org_admin'
    case 'org:secretary':
      return 'org_secretary'
    case 'org:member':
    default:
      return 'org_viewer'
  }
}
