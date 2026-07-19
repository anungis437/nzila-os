import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './lib/locales'

type ProxyRequest = NextRequest & { auth?: unknown }

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
})

/**
 * Public paths — everything else requires authentication.
 * Cora is read-only analytics — same auth enforcement as Agrimo.
 */
const publicPaths = [
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/webhooks',
  '/api/health',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return publicPaths.some(p => pathname.startsWith(p))
}

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

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

  // ── Auth protection — redirect unauthenticated users ──────────────────
  if (!isPublicPath(pathname) && !request.auth) {
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
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID()
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
