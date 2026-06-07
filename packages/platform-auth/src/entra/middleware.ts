/**
 * @nzila/platform-auth — Entra Auth Middleware
 *
 * Drop-in replacement for Clerk's `clerkMiddleware()`.
 * Uses NextAuth v5 `auth()` for JWT session validation at the edge.
 * Also recognises PG-backed password auth sessions (`nzila_session` cookie).
 *
 * Usage in app middleware.ts:
 *   import { createAuthMiddleware } from '@nzila/platform-auth/entra/middleware'
 *   export default createAuthMiddleware({ publicRoutes: ['/'] })
 *   export const config = { matcher: [...] }
 */
import { auth } from './config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Cookie name for PG-backed password auth sessions */
const PG_SESSION_COOKIE = 'nzila_session'

/**
 * Check if the request has a PG-backed session cookie.
 * Edge-safe: only checks cookie presence, no DB lookup.
 * Full validation happens server-side in auth().
 */
export function hasPgSessionCookie(request: NextRequest): boolean {
  const enablePgFallback =
    (process.env.NZILA_AUTH_ENABLE_PG_FALLBACK
      ?? process.env.NEXT_PUBLIC_NZILA_AUTH_ENABLE_PG_FALLBACK
      ?? 'true').toLowerCase() !== 'false'
  if (!enablePgFallback) return false
  return !!request.cookies.get(PG_SESSION_COOKIE)?.value
}

export interface AuthMiddlewareOptions {
  /**
   * Route patterns that don't require authentication.
   * Supports glob patterns (* for wildcard, ** for recursive).
   */
  publicRoutes?: string[]
  /**
   * Custom handler called with (auth, request) — same signature as clerkMiddleware callback.
   * Return a NextResponse to short-circuit, or undefined to continue.
   */
  onAuth?: (
    authState: { userId: string | null; orgId: string | null; orgRole: string | null },
    request: NextRequest,
  ) => Promise<NextResponse | undefined | void>
  /** URL to redirect unauthenticated users (default: /sign-in). */
  signInUrl?: string
}

type MiddlewareSession = Record<string, unknown> & {
  user?: { id?: string }
  activeOrgId?: string
  orgRole?: string
}

type MiddlewareRequest = NextRequest & {
  auth?: MiddlewareSession
}

/**
 * Create an auth middleware — replaces `clerkMiddleware()`.
 *
 * This wraps NextAuth's `auth()` to provide the same middleware pattern
 * that Clerk uses, with public route matching and custom auth callbacks.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const {
    publicRoutes = [],
    onAuth,
    signInUrl = '/sign-in',
  } = options

  const publicMatchers = publicRoutes.map(pattern => {
    const escaped = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*')
    return new RegExp(`^${escaped}$`)
  })

  const isPublic = (pathname: string) =>
    publicMatchers.some(re => re.test(pathname))

  const withAuthMiddleware = auth as unknown as (
    middleware: (req: MiddlewareRequest) => Promise<NextResponse> | NextResponse,
  ) => NextResponse | Promise<NextResponse>

  return withAuthMiddleware(async (req: MiddlewareRequest) => {
    const session = req.auth
    const userId = session?.user?.id ?? null
    const orgId = typeof session?.activeOrgId === 'string' ? session.activeOrgId : null
    const orgRole = typeof session?.orgRole === 'string' ? session.orgRole : null

    // Run custom auth handler if provided
    if (onAuth) {
      const result = await onAuth({ userId, orgId, orgRole }, req)
      if (result) return result
    }

    // Public routes — pass through
    if (isPublic(req.nextUrl.pathname)) {
      return NextResponse.next()
    }

    // Static files and internal Next.js routes — always pass
    if (
      req.nextUrl.pathname.startsWith('/_next') ||
      req.nextUrl.pathname.startsWith('/api/auth') ||
      req.nextUrl.pathname.includes('.')
    ) {
      return NextResponse.next()
    }

    // Protect remaining routes
    if (!userId) {
      // Check for PG-backed password auth session cookie
      if (hasPgSessionCookie(req)) {
        return NextResponse.next()
      }
      const url = new URL(signInUrl, req.url)
      url.searchParams.set('callbackUrl', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  })
}

/**
 * Default auth middleware with standard public routes.
 * Use this if you don't need custom configuration.
 */
export const defaultAuthMiddleware = createAuthMiddleware({
  publicRoutes: [
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/login(.*)',
    '/signup(.*)',
    '/forgot-password(.*)',
    '/reset-password(.*)',
    '/api/health',
    '/api/webhooks(.*)',
    '/api/auth(.*)',
  ],
})
