/**
 * @nzila/platform-auth — Entra Server-Side Auth Functions
 *
 * Platform auth functions for server-side usage:
 *   - auth()        → returns session with userId/orgId/orgRole
 *   - currentUser() → returns user-like object
 *   - getAuth()     → deprecated alias for auth()
 *
 * These read the NextAuth session on the server side (RSC / API routes).
 *
 * Usage in server components:
 *   import { auth, currentUser } from '@nzila/platform-auth/entra/server'
 *
 *   export default async function Page() {
 *     const { userId } = await auth()
 *     if (!userId) redirect('/sign-in')
 *   }
 */
import { auth as nextAuth } from './config'
import { resolveIdentityFromEntra } from './adapter'
import type { AuthResult, AuthenticatedIdentity } from '../identity'
import type { EntraSession } from './types'

/** Session type alias */
export type Session = EntraSession

/** Cookie name for PG-backed password auth sessions */
const PG_SESSION_COOKIE = 'nzila_session'

function isPgFallbackEnabled(): boolean {
  const raw =
    process.env.NZILA_AUTH_ENABLE_PG_FALLBACK
    ?? process.env.NEXT_PUBLIC_NZILA_AUTH_ENABLE_PG_FALLBACK
    ?? 'true'
  return raw.toLowerCase() !== 'false'
}

// ── Server Auth ─────────────────────────────────────────────────────────────

export interface AuthSessionResult {
  userId: string | null
  orgId: string | null
  orgRole: string | null
  sessionId: string | null
  sessionClaims: Record<string, unknown> | null
  getToken: (options?: Record<string, unknown>) => Promise<string | null>
  /** Clerk-compat `has()` — checks role/permission against orgRole. */
  has: (params: { role?: string; permission?: string }) => boolean
}

/**
 * Platform `auth()` — returns `{ userId, orgId, orgRole }`.
 *
 * Resolution order:
 *   1. PG session cookie (`nzila_session`) — email/password auth
 *   2. Entra / NextAuth JWT — SSO
 */
const isE2ETestAuthEnabled = (): boolean =>
  (process.env.PLAYWRIGHT_TEST_AUTH ?? '').toLowerCase() === 'true'

export async function auth(): Promise<AuthSessionResult> {
  // ── 1. Try PG session-based auth ────────────────────────────────────────
  try {
    if (!isPgFallbackEnabled()) {
      throw new Error('PG fallback disabled')
    }
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const pgToken = cookieStore.get(PG_SESSION_COOKIE)?.value
    if (pgToken) {
      const { getAuthUser } = await import('../password/auth-service')
      let pgUser = await getAuthUser()
      // E2E test escape hatch: when PLAYWRIGHT_TEST_AUTH=true and the cookie
      // value matches the deterministic seed token shape `ue-seed-session-<userId>`,
      // accept it directly without depending on opaque DB session validation.
      // Fail-closed: only active when PLAYWRIGHT_TEST_AUTH is explicitly set,
      // which is never true in production runtimes.
      if (!pgUser && isE2ETestAuthEnabled() && pgToken.startsWith('ue-seed-session-')) {
        const userId = pgToken.slice('ue-seed-session-'.length)
        if (userId) {
          try {
            const { db } = await import('@nzila/db/client')
            const { authUsers, authOrganizationUsers } = await import('@nzila/db/schema')
            const { eq, and } = await import('drizzle-orm')
            const [authRow] = await db
              .select({
                id: authUsers.userId,
                email: authUsers.email,
                firstName: authUsers.firstName,
                lastName: authUsers.lastName,
              })
              .from(authUsers)
              .where(and(eq(authUsers.userId, userId), eq(authUsers.isActive, true)))
              .limit(1)
            if (authRow) {
              const [membership] = await db
                .select({ organizationId: authOrganizationUsers.organizationId })
                .from(authOrganizationUsers)
                .where(
                  and(
                    eq(authOrganizationUsers.userId, userId),
                    eq(authOrganizationUsers.isActive, true),
                  ),
                )
                .limit(1)
              pgUser = {
                ...authRow,
                organizationId: membership?.organizationId ?? null,
                sessionId: pgToken,
              }
            }
          } catch {
            // E2E auth bridge lookup failed; fall through to standard paths.
          }
        }
      }
      if (pgUser) {
        // Resolve org role from DB
        let orgRole: string | null = null
        try {
          const { db } = await import('@nzila/db/client')
          const { authOrganizationUsers } = await import('@nzila/db/schema')
          const { eq, and } = await import('drizzle-orm')
          if (pgUser.organizationId) {
            const [membership] = await db
              .select({ role: authOrganizationUsers.role })
              .from(authOrganizationUsers)
              .where(
                and(
                  eq(authOrganizationUsers.userId, pgUser.id),
                  eq(authOrganizationUsers.organizationId, pgUser.organizationId),
                ),
              )
              .limit(1)
            orgRole = membership?.role ?? null
          }
        } catch {
          // DB lookup failed — continue without role
        }

        return {
          userId: pgUser.id,
          orgId: pgUser.organizationId,
          orgRole,
          sessionId: pgUser.sessionId,
          sessionClaims: {
            email: pgUser.email,
            name: [pgUser.firstName, pgUser.lastName].filter(Boolean).join(' '),
            authMethod: 'password',
          },
          getToken: async () => null,
          has: (params: { role?: string; permission?: string }) => {
            if (params.role) return orgRole === params.role
            return false
          },
        }
      }
    }
  } catch {
    // PG session check failed — fall through to Entra
  }

  // ── 2. Fall back to Entra / NextAuth ────────────────────────────────────
  const session = await nextAuth()
  const entra = session as EntraSession | null

  if (!session?.user) {
    return { userId: null, orgId: null, orgRole: null, sessionId: null, sessionClaims: null, getToken: async () => null, has: () => false }
  }

  return {
    userId: entra?.entraObjectId ?? session.user.id ?? null,
    orgId: entra?.activeOrgId ?? null,
    orgRole: entra?.orgRole ?? null,
    sessionId: entra?.entraObjectId ?? session.user.id ?? null,
    sessionClaims: {
      roles: entra?.roles ?? [],
      email: session.user.email,
      name: session.user.name,
    },
    getToken: async () => entra?.accessToken ?? null,
    has: (params: { role?: string; permission?: string }) => {
      const currentRole = entra?.orgRole ?? null
      const roles = entra?.roles ?? []
      if (params.role) return currentRole === params.role || roles.includes(params.role)
      if (params.permission) return roles.includes(params.permission)
      return false
    },
  }
}

/**
 * Platform `currentUser()` — returns a user-like object.
 *
 * Checks PG session first, then falls back to Entra/NextAuth.
 */
export async function currentUser() {
  // ── 1. Try PG session ───────────────────────────────────────────────────
  try {
    if (!isPgFallbackEnabled()) {
      throw new Error('PG fallback disabled')
    }
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const pgToken = cookieStore.get(PG_SESSION_COOKIE)?.value
    if (pgToken) {
      const { getAuthUser } = await import('../password/auth-service')
      let pgUser = await getAuthUser()
      // Same E2E test escape hatch as auth() above. See note there.
      if (!pgUser && isE2ETestAuthEnabled() && pgToken.startsWith('ue-seed-session-')) {
        const userId = pgToken.slice('ue-seed-session-'.length)
        if (userId) {
          try {
            const { db } = await import('@nzila/db/client')
            const { authUsers, authOrganizationUsers } = await import('@nzila/db/schema')
            const { eq, and } = await import('drizzle-orm')
            const [authRow] = await db
              .select({
                id: authUsers.userId,
                email: authUsers.email,
                firstName: authUsers.firstName,
                lastName: authUsers.lastName,
              })
              .from(authUsers)
              .where(and(eq(authUsers.userId, userId), eq(authUsers.isActive, true)))
              .limit(1)
            if (authRow) {
              const [membership] = await db
                .select({ organizationId: authOrganizationUsers.organizationId })
                .from(authOrganizationUsers)
                .where(
                  and(
                    eq(authOrganizationUsers.userId, userId),
                    eq(authOrganizationUsers.isActive, true),
                  ),
                )
                .limit(1)
              pgUser = {
                ...authRow,
                organizationId: membership?.organizationId ?? null,
                sessionId: pgToken,
              }
            }
          } catch {
            // E2E auth bridge lookup failed; fall through to standard paths.
          }
        }
      }
      if (pgUser) {
        return {
          id: pgUser.id,
          firstName: pgUser.firstName,
          lastName: pgUser.lastName,
          fullName: [pgUser.firstName, pgUser.lastName].filter(Boolean).join(' ') || null,
          emailAddresses: [{ emailAddress: pgUser.email }],
          primaryEmailAddress: { emailAddress: pgUser.email },
          username: pgUser.email,
          primaryPhoneNumber: null as { phoneNumber: string } | null,
          createdAt: null as Date | null,
          imageUrl: null as string | null,
          publicMetadata: {
            authMethod: 'password',
          },
          privateMetadata: {},
          organizationMemberships: pgUser.organizationId
            ? [{ organization: { id: pgUser.organizationId }, role: 'member' }]
            : [],
        }
      }
    }
  } catch {
    // PG session check failed — fall through to Entra
  }

  // ── 2. Fall back to Entra / NextAuth ────────────────────────────────────
  const session = await nextAuth()
  const entra = session as EntraSession | null

  if (!session?.user) return null

  return {
    id: entra?.entraObjectId ?? session.user.id ?? '',
    firstName: session.user.name?.split(' ')[0] ?? null,
    lastName: session.user.name?.split(' ').slice(1).join(' ') || null,
    fullName: session.user.name ?? null,
    emailAddresses: session.user.email
      ? [{ emailAddress: session.user.email }]
      : [],
    primaryEmailAddress: session.user.email
      ? { emailAddress: session.user.email }
      : null,
    username: session.user.name ?? null,
    primaryPhoneNumber: null as { phoneNumber: string } | null,
    createdAt: null as Date | null,
    imageUrl: session.user.image ?? null,
    publicMetadata: {
      roles: entra?.roles ?? [],
      role: entra?.roles?.[0] ?? undefined,
      nzilaRole: entra?.roles?.[0] ?? undefined,
      tenantId: entra?.activeOrgId ?? undefined,
      organizationId: entra?.activeOrgId ?? undefined,
    },
    privateMetadata: {
      role: entra?.roles?.[0] ?? undefined,
      tenantId: entra?.activeOrgId ?? undefined,
      organizationId: entra?.activeOrgId ?? undefined,
    },
    organizationMemberships: entra?.activeOrgId
      ? [{ organization: { id: entra.activeOrgId }, role: entra?.orgRole ?? 'member' }]
      : [],
  }
}

/**
 * Legacy `getAuth(req)` — extract auth state from a request.
 * @deprecated Use `auth()` instead — auto-resolves the request.
 */
export async function getAuth(_req?: unknown): Promise<AuthSessionResult> {
  return auth()
}

// ── Platform Auth Functions ─────────────────────────────────────────────────

/**
 * Get the authenticated session as an AuthResult.
 * Use when you need the full platform AuthResult type.
 */
export async function getAuthSession(): Promise<AuthResult> {
  const session = await nextAuth()
  return resolveIdentityFromEntra(session)
}

/**
 * Get the current authenticated user as AuthenticatedIdentity.
 */
export async function getCurrentUser(): Promise<AuthenticatedIdentity | null> {
  const result = await getAuthSession()
  if (!result.ok) return null
  return result.identity
}

/**
 * Get the raw NextAuth session (with Entra extensions).
 * Use when you need access to tokens or raw session data.
 */
export async function getRawSession(): Promise<EntraSession | null> {
  const session = await nextAuth()
  return session as EntraSession | null
}

/**
 * Require authentication — throws redirect to sign-in if not authenticated.
 * Use in server components / layouts for protected pages.
 */
export async function requireAuthentication(): Promise<AuthenticatedIdentity> {
  const result = await getAuthSession()
  if (!result.ok) {
    const { redirect } = await import('next/navigation')
    redirect('/sign-in')
  }
  return (result as { ok: true; identity: AuthenticatedIdentity }).identity
}

/**
 * Get the active organization ID from the session.
 */
export async function getActiveOrgId(): Promise<string | undefined> {
  const session = await nextAuth() as EntraSession | null
  return session?.activeOrgId
}

/**
 * Get app roles from the Entra session.
 */
export async function getSessionRoles(): Promise<string[]> {
  const session = await nextAuth() as EntraSession | null
  return session?.roles ?? []
}

// ── Admin Client Re-export ──────────────────────────────────────────────────

export { adminClient, adminClient as clerkClient } from './admin'

// ── Route Matching Utility ──────────────────────────────────────────────────

/**
 * Create a route matcher function from an array of path patterns.
 * Drop-in replacement for Clerk's `createRouteMatcher()`.
 *
 * Supports patterns like:
 *   - "/dashboard(.*)"   → matches /dashboard and /dashboard/anything
 *   - "/:locale/page"    → matches /en-CA/page, /fr-CA/page
 *   - "/api/health"      → exact match
 */
export function createRouteMatcher(patterns: string[]) {
  const regexes = patterns.map((pattern) => {
    // Convert :param to a named group pattern
    let regex = pattern.replace(/:[a-zA-Z_]+/g, '[^/]+')
    // Escape forward slashes and dots for regex
    regex = regex.replace(/\//g, '\\/').replace(/\./g, '\\.')
    // Convert escaped `.*` back to regex wildcard; parentheses in patterns (e.g. `(.*)`) are preserved as groups
    // codeql[js/incomplete-sanitization] - patterns are developer-defined route strings, not user input
    regex = regex.replace(/\\\.\*/g, '.*')
    return new RegExp(`^${regex}$`)
  })

  return (req: { nextUrl?: { pathname: string }; url?: string } | string) => {
    const pathname =
      typeof req === 'string'
        ? req
        : (req as { nextUrl?: { pathname: string } }).nextUrl?.pathname ??
          new URL((req as { url: string }).url).pathname
    return regexes.some((r) => r.test(pathname))
  }
}

// ── Auth Middleware ──────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

/**
 * Platform auth middleware.
 *
 * Wraps NextAuth's `auth()` middleware. The callback receives an `auth`
 * object with `.protect()` (redirects to /sign-in) and a callable form
 * that returns `{ userId, orgId, orgRole, sessionClaims }`.
 */

class AuthProtectRedirect {
  constructor(public url: string) {}
}

export function authMiddleware(
  handler: (auth: any, request: any) => Promise<any> | any,
) {
  return nextAuth(async (req: any) => {
    const session = req.auth as any
    const authCompat = Object.assign(
      // auth() callable — returns session-like object
      async () => ({
        userId: session?.entraObjectId ?? session?.user?.id ?? null,
        orgId: session?.activeOrgId ?? null,
        orgRole: session?.orgRole ?? null,
        sessionClaims: {
          metadata: { role: session?.roles?.[0] ?? undefined },
        },
      }),
      {
        // auth.protect() — redirect if unauthenticated (throws like Clerk)
        protect: async () => {
          if (!session?.user) {
            const signInUrl = new URL('/sign-in', req.url)
            signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname)
            throw new AuthProtectRedirect(signInUrl.toString())
          }
        },
      },
    )
    try {
      return await handler(authCompat, req)
    } catch (e) {
      if (e instanceof AuthProtectRedirect) {
        return NextResponse.redirect(e.url)
      }
      throw e
    }
  }) as any
}

/** @deprecated Use `authMiddleware` instead */
export const clerkMiddleware = authMiddleware
