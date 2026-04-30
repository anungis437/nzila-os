import { authMiddleware, createRouteMatcher } from '@nzila/platform-auth/entra/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'

/**
 * Maestria Edge Middleware — Four-layer protection aligned with console reference.
 *
 * Layer 1: Rate limiting (skip in dev — HMR triggers too many requests)
 * Layer 2: Idempotency-Key enforcement (skip in dev)
 * Layer 3: Authentication (skip in dev — prevents handshake loops)
 * Layer 4: Request-ID propagation (x-request-id header)
 */

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth(.*)',
  '/api/health(.*)',
  '/api/webhooks(.*)',
])

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

export const proxy = authMiddleware(async (auth, request: NextRequest) => {
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

  // ── Authentication (skip in dev — prevents auth handshake loops) ────
  if (process.env.NODE_ENV !== 'development' && !isPublicRoute(request)) {
    await auth.protect()
  }

  // ── Request-ID propagation ────────────────────────────────────────────
  const response = NextResponse.next()
  const requestId =
    request.headers.get('x-request-id') ?? crypto.randomUUID()
  response.headers.set('x-request-id', requestId)
  return response
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
