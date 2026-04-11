import { authMiddleware, createRouteMatcher } from '@nzila/platform-auth/entra/server'
import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'
import { checkOrgRateLimit, orgRateLimitHeaders } from '@nzila/os-core/orgRateLimit'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './lib/locales'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
  localeDetection: true,
})

/**
 * Partner Portal — route protection via platform auth.
 *
 * Public routes: landing, sign-in/up, invite acceptance, webhooks.
 * /api/health is intentionally public (probe endpoints must not require auth).
 * Everything else (the portal itself) requires authentication.
 */
const _isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)',
  '/api/auth(.*)',
  '/api/webhooks(.*)',
  '/api/health(.*)',
])

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

export default authMiddleware(async (auth, request) => {
  // ── Rate limiting (skip in dev — HMR triggers too many requests) ──────
  if (process.env.NODE_ENV !== 'development') {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'
    const rl = checkRateLimit(ip, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests' },
        {
          status: 429,
          headers: rateLimitHeaders(rl, RATE_LIMIT_MAX),
        },
      )
    }
  }

  // ── Org-scoped rate limiting (per-org + route-group buckets) ────────
  if (process.env.NODE_ENV !== 'development') {
    const orgId = request.headers.get('x-org-id')
    if (orgId && request.nextUrl.pathname.startsWith('/api')) {
      const orgRl = checkOrgRateLimit(
        orgId,
        request.nextUrl.pathname,
        request.method,
      )
      if (!orgRl.allowed) {
        return NextResponse.json(
          {
            error: 'Org Rate Limit Exceeded',
            message: `Rate limit exceeded for route group: ${orgRl.routeGroup}`,
            code: 'ORG_RATE_LIMIT_EXCEEDED',
          },
          {
            status: 429,
            headers: orgRateLimitHeaders(orgRl),
          },
        )
      }
    }
  }

  // ── Idempotency-Key enforcement (fail-closed in pilot/prod) ──────────
  if (process.env.NODE_ENV !== 'development') {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      request.nextUrl.pathname.startsWith('/api') &&
      !request.nextUrl.pathname.startsWith('/api/auth') &&
      !request.nextUrl.pathname.startsWith('/api/webhooks') &&
      !request.nextUrl.pathname.startsWith('/api/health') &&
      !request.nextUrl.pathname.startsWith('/api/cron')
    ) {
      if (!request.headers.get('idempotency-key')) {
        return NextResponse.json(
          {
            error: 'Missing Idempotency-Key header',
            message:
              'All mutation requests (POST, PUT, PATCH, DELETE) must include an Idempotency-Key header.',
            code: 'IDEMPOTENCY_KEY_REQUIRED',
          },
          { status: 400 },
        )
      }
    }
  }

  // ── Authentication ────────────────────────────────────────────────────
  // Auth enforcement moved to server-side layouts (portal/layout.tsx,
  // admin/layout.tsx) which run on Node.js. Edge middleware's
  // crypto.subtle fails with OpenSSL 3 OperationError on Azure
  // Container Apps; server components use Node.js native crypto.

  // ── Request-ID propagation ────────────────────────────────────────────
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID()

  // i18n locale detection (cookie / Accept-Language)
  if (!request.nextUrl.pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(request)
    if (intlResponse instanceof NextResponse) {
      intlResponse.headers.set('x-request-id', requestId)
      return intlResponse
    }
    const nr = NextResponse.next({ headers: new Headers((intlResponse as Response).headers) })
    nr.headers.set('x-request-id', requestId)
    return nr
  }

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
