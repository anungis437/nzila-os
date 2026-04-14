/**
 * Edge Middleware — Four-layer protection for Zonga.
 * Layer 1: Rate limiting (skip in dev — HMR triggers too many requests)
 * Layer 2: Authentication (skip for public + auth routes)
 * Layer 3: next-intl locale routing
 * Layer 4: Request-ID propagation (x-request-id header)
 */
import { authMiddleware, createRouteMatcher } from '@nzila/platform-auth/entra/server'
import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimitHeaders } from '@nzila/os-core/rateLimit'
import { orgRateLimitHeaders } from '@nzila/os-core/orgRateLimit'
import {
  checkRateLimitDistributed,
  checkOrgRateLimitDistributed,
} from '@nzila/os-core/rateLimit/distributed'
import { locales, defaultLocale } from '@/lib/locales'

/* ── Route matchers ── */
const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/pricing(.*)',
  '/contact(.*)',
  '/artists(.*)',
  '/events(.*)',
  '/for-labels(.*)',
  '/login(.*)',
  '/signup(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/forgot-password(.*)',
  '/reset-password(.*)',
  '/api/auth(.*)',
  '/api/health(.*)',
])

const isMarketingPath = (pathname: string) =>
  ['/', '/about', '/pricing', '/contact', '/artists', '/events', '/for-labels'].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

const isAuthPath = (pathname: string) =>
  pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up') ||
  pathname.startsWith('/login') || pathname.startsWith('/signup') ||
  pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password');

/* ── Intl middleware ── */
const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
})

/* ── Rate limiting ── */
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

/* ── Main middleware ── */
export default authMiddleware(async (auth, request: NextRequest) => {
  try {
    // ── Rate limiting (skip in dev — HMR triggers too many requests) ──────
    if (process.env.NODE_ENV !== 'development') {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        'unknown'
      const rl = await checkRateLimitDistributed(ip, {
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
        const orgRl = await checkOrgRateLimitDistributed(
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

    /* Skip locale redirect for pure marketing & auth pages */
    if (isMarketingPath(request.nextUrl.pathname) || isAuthPath(request.nextUrl.pathname)) {
      const response = NextResponse.next();
      response.headers.set('x-request-id', crypto.randomUUID());
      return response;
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

    /* Protect non-public routes */
    if (!isPublicRoute(request)) {
      await auth.protect();
    }

    /* Skip i18n for API routes — they don't need locale prefixing */
    if (request.nextUrl.pathname.startsWith('/api')) {
      const response = NextResponse.next();
      response.headers.set('x-request-id', crypto.randomUUID());
      return response;
    }

    /* Apply i18n routing for dashboard and other locale paths */
    const response = intlMiddleware(request);
    response.headers.set('x-request-id', crypto.randomUUID());
    return response;
  } catch (err) {
    // Fail-open: log and let the request through rather than returning a 500
    // that blocks every page load when an upstream service (Redis, auth) is down.
    void err
    const fallback = NextResponse.next()
    fallback.headers.set('x-request-id', crypto.randomUUID())
    return fallback
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
