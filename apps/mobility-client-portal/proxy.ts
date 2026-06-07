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

/**
 * Public routes — everything else requires authentication.
 * /api/health is intentionally public (probe endpoints must not require auth).
 */
const publicPaths = ['/', '/sign-in', '/sign-up', '/api/webhooks', '/api/health', '/api/auth']

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

type ProxyRequest = NextRequest & { auth?: unknown }

export const proxy = auth((req: unknown) => {
  const request = req as ProxyRequest
  const { pathname } = request.nextUrl

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

  // ── Authentication ────────────────────────────────────────────────────
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isPublic && !request.auth) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // ── Internationalisation ──────────────────────────────────────────────
  if (!pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(request)
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    intlResponse.headers.set('x-request-id', requestId)
    return intlResponse
  }

  // ── Request-ID propagation ────────────────────────────────────────────
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  return response
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
