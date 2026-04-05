/**
 * @nzila/platform-auth — Entra ID Adapter
 *
 * Converts NextAuth/Entra session data into platform AuthResult types.
 * This is the Entra counterpart to clerk-adapter.ts — the same
 * AuthenticatedIdentity / AuthResult interfaces, different provider.
 *
 * Usage:
 *   import { auth } from '@nzila/platform-auth/entra/config'
 *   import { resolveIdentityFromEntra } from '@nzila/platform-auth/entra/adapter'
 *
 *   const session = await auth()
 *   const result = resolveIdentityFromEntra(session)
 *   if (!result.ok) return NextResponse.json(result, { status: result.httpStatus })
 *   // result.identity: AuthenticatedIdentity
 */
import type { Session } from 'next-auth'
import type { AuthenticatedIdentity, AuthResult, OrgMembership } from '../identity'
import type { EntraSession } from './types'

// ── Identity Resolution ─────────────────────────────────────────────────────

/**
 * Resolve an AuthenticatedIdentity from a NextAuth/Entra session.
 *
 * @param session — NextAuth session (from `await auth()`)
 */
export function resolveIdentityFromEntra(
  session: Session | EntraSession | null,
): AuthResult {
  if (!session?.user) {
    return {
      ok: false,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required',
      httpStatus: 401,
    }
  }

  const entraSession = session as EntraSession

  const identity: AuthenticatedIdentity = {
    userId: entraSession.entraObjectId ?? session.user.id ?? '',
    email: session.user.email ?? undefined,
    displayName: session.user.name ?? session.user.email ?? '',
    avatarUrl: session.user.image ?? undefined,
    activeOrgId: entraSession.activeOrgId ?? undefined,
    orgRole: entraSession.orgRole ?? deriveOrgRoleFromAppRoles(entraSession.roles),
    sessionClaims: {
      roles: entraSession.roles ?? [],
      tenantId: entraSession.tenantId,
      identityProvider: entraSession.identityProvider,
      isExternalUser: entraSession.isExternalUser,
    },
    isService: false,
  }

  return { ok: true, identity }
}

/**
 * Resolve a service identity from Bearer token (internal API calls).
 * Validates against platform service key.
 */
export function resolveEntraServiceIdentity(
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

// ── Role Mapping ────────────────────────────────────────────────────────────

/**
 * Derive org role from Entra app role assignments.
 *
 * Entra app roles are flat strings (e.g., "org_admin", "system.admin",
 * "ue.grievance_officer"). This maps to the canonical org role hierarchy.
 */
function deriveOrgRoleFromAppRoles(roles: string[]): string | undefined {
  if (!roles || roles.length === 0) return undefined

  // Priority: system admin > org admin > secretary > viewer
  if (roles.includes('system.admin') || roles.includes('platform.admin')) {
    return 'org_admin'
  }
  if (roles.some(r => r.endsWith('.admin') || r === 'org_admin')) {
    return 'org_admin'
  }
  if (roles.some(r => r.includes('secretary') || r.includes('officer'))) {
    return 'org_secretary'
  }
  return 'org_viewer'
}

/**
 * Map Entra app role string to canonical OrgMembership role.
 */
export function mapEntraRoleToOrgRole(
  entraRoles: string[],
): OrgMembership['role'] {
  if (entraRoles.some(r => r.endsWith('.admin') || r === 'org_admin' || r === 'system.admin')) {
    return 'org_admin'
  }
  if (entraRoles.some(r => r.includes('secretary'))) {
    return 'org_secretary'
  }
  return 'org_viewer'
}

/**
 * Check if the session has a specific app role.
 */
export function hasEntraRole(session: EntraSession | null, role: string): boolean {
  return session?.roles?.includes(role) ?? false
}

/**
 * Check if the session has any of the specified app roles.
 */
export function hasAnyEntraRole(session: EntraSession | null, roles: string[]): boolean {
  if (!session?.roles) return false
  return roles.some(r => session.roles.includes(r))
}
