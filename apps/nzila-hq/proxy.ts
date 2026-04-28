import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'

/**
 * Nzila HQ Edge Middleware — edge-safe.
 *
 * Mirrors the platform-admin pattern: rate-limit + request-ID propagation only.
 * Auth is delegated to server components / route handlers via `lib/resolve-org.ts`
 * to avoid edge-runtime `node:crypto` failures from `@nzila/platform-auth/entra/*`
 * (see user memory: "Entra Auth Gotchas").
 */

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = async (request: any) => {
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

  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const correlationId = request.headers.get('x-correlation-id') ?? requestId

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-correlation-id', correlationId)
  response.headers.set('x-nzila-app', 'nzila-hq')
  return response
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
