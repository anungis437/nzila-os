import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './lib/locales'

type ProxyRequest = NextRequest & { auth?: unknown }

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
})

export const proxy = (req: unknown) => {
  const request = req as ProxyRequest
  const { pathname } = request.nextUrl

  // -- Idempotency-Key enforcement (fail-closed in pilot/prod) --
  if (process.env.NODE_ENV !== 'development') {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
      pathname.startsWith('/api') &&
      !pathname.startsWith('/api/auth') &&
      !pathname.startsWith('/api/webhooks') &&
      !pathname.startsWith('/api/health') &&
      !pathname.startsWith('/api/cron') &&
      !pathname.startsWith('/api/policies/replay')
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

  // -- Request-ID + Correlation-ID propagation --
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const correlationId = request.headers.get('x-correlation-id') ?? requestId

  // -- Internationalisation --
  if (!pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(request)
    intlResponse.headers.set('x-request-id', requestId)
    intlResponse.headers.set('x-correlation-id', correlationId)
    return intlResponse
  }

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-correlation-id', correlationId)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
