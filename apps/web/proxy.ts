import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'
import { locales, defaultLocale, type Locale } from './lib/locales'
import { detectLocaleFromHeaders } from './lib/i18n-utils'

/**
 * Public web site — all routes are public.
 * Auth provider is present for optional sign-in state in the layout.
 * Rate limiting is enforced at the edge for every request.
 */

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '200')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth(async (request: any) => {
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

  // ── Idempotency-Key enforcement (fail-closed in pilot/prod) ──────────
  if (process.env.NODE_ENV !== 'development') {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      request.nextUrl.pathname.startsWith('/api') &&
      !request.nextUrl.pathname.startsWith('/api/webhooks') &&
      !request.nextUrl.pathname.startsWith('/api/health') &&
      !request.nextUrl.pathname.startsWith('/api/cron') &&
      !request.nextUrl.pathname.startsWith('/api/auth')
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

  /* ── Request-ID propagation for observability ── */
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()

  // Locale detection — set cookie so getRequestConfig can read it (no URL rewrite)
  if (!request.nextUrl.pathname.startsWith('/api')) {
    const locale: Locale = detectLocaleFromHeaders(request.headers, locales, defaultLocale)
    const response = NextResponse.next()
    response.headers.set('x-request-id', requestId)
    response.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax' })
    return response
  }

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  return response
}) as (request: NextRequest) => Promise<NextResponse>

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
