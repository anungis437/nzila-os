import { auth } from '@nzila/platform-auth/entra/config'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './lib/locales'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
})

const publicPaths = ['/', '/sign-in', '/sign-up', '/api/webhooks', '/api/health', '/api/auth']

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

type ProxyRequest = NextRequest & { auth?: unknown }

export const proxy = auth((request: unknown) => {
  const req = request as ProxyRequest

  // ── Rate limiting (skip in dev — HMR triggers too many requests) ──────
  if (process.env.NODE_ENV !== 'development') {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
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

  // ── Idempotency-Key enforcement (fail-closed in pilot/prod) ──────────
  if (process.env.NODE_ENV !== 'development') {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      req.nextUrl.pathname.startsWith('/api') &&
      !req.nextUrl.pathname.startsWith('/api/auth') &&
      !req.nextUrl.pathname.startsWith('/api/webhooks') &&
      !req.nextUrl.pathname.startsWith('/api/health') &&
      !req.nextUrl.pathname.startsWith('/api/cron')
    ) {
      if (!req.headers.get('idempotency-key')) {
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

  // ── Authentication ────────────────────────────────────────────────────────────────────
  const isPublic = publicPaths.some(p => req.nextUrl.pathname.startsWith(p))
  if (!isPublic && !req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // ── Internationalisation ──────────────────────────────────────────────
  if (!req.nextUrl.pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(req)
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
    intlResponse.headers.set('x-request-id', requestId)
    return intlResponse
  }

  // ── Request-ID propagation ────────────────────────────────────────────
  const requestId =
    req.headers.get('x-request-id') ?? crypto.randomUUID()
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
