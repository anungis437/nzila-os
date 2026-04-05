/**
 * @nzila/platform-auth — Entra Server-Side Auth Functions
 *
 * Drop-in replacements for Clerk's server-side auth functions:
 *   - auth()        → auth()        (Clerk-compatible shape)
 *   - currentUser() → currentUser() (Clerk-compatible shape)
 *   - getAuth()     → getAuth()     (older Clerk pattern)
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
import { auth as nextAuth } from './config.js'
import { resolveIdentityFromEntra } from './adapter.js'
import type { AuthResult, AuthenticatedIdentity } from '../identity.js'
import type { EntraSession } from './types.js'

/** Session type alias for Clerk compatibility */
export type Session = EntraSession

// ── Clerk-Compatible Server Auth ────────────────────────────────────────────

export interface ClerkCompatAuthResult {
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
 * Clerk-compatible `auth()` — returns `{ userId, orgId, orgRole }`.
 * Direct drop-in for `import { auth } from '@clerk/nextjs/server'`.
 */
export async function auth(): Promise<ClerkCompatAuthResult> {
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
 * Clerk-compatible `currentUser()` — returns a user-like object.
 * Direct drop-in for `import { currentUser } from '@clerk/nextjs/server'`.
 */
export async function currentUser() {
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
 * Older Clerk pattern: `getAuth(req)` → extract auth state from a request.
 * @deprecated Use `auth()` instead — NextAuth v5 auto-resolves the request.
 */
export async function getAuth(_req?: unknown): Promise<ClerkCompatAuthResult> {
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

export { clerkClient } from './admin.js'

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
    // Convert (.*) to regex
    regex = regex.replace(/\\\.\*/g, '.*').replace(/\(/, '(').replace(/\)/, ')')
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

// ── clerkMiddleware Compat ──────────────────────────────────────────────────

import { NextResponse } from 'next/server'

/**
 * Drop-in replacement for Clerk's `clerkMiddleware()`.
 *
 * Wraps NextAuth's `auth()` middleware. The callback receives a compat `auth`
 * object with `.protect()` (redirects to /sign-in) and a callable form
 * that returns `{ userId, orgId, orgRole, sessionClaims }`.
 */

class AuthProtectRedirect {
  constructor(public url: string) {}
}

export function clerkMiddleware(
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
