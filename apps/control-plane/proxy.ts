import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './lib/locales'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
})

const publicPaths = ['/', '/sign-in', '/sign-up', '/api/health', '/api/auth']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth((req: any) => {
  const { pathname } = req.nextUrl

  // -- Idempotency-Key enforcement (fail-closed in pilot/prod) --
  if (process.env.NODE_ENV !== 'development') {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      pathname.startsWith('/api') &&
      !pathname.startsWith('/api/auth') &&
      !pathname.startsWith('/api/webhooks') &&
      !pathname.startsWith('/api/health') &&
      !pathname.startsWith('/api/cron')
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

  // -- Authentication --
  const isPublic = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (!isPublic && !req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // -- Request-ID + Correlation-ID propagation --
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
  const correlationId = req.headers.get('x-correlation-id') ?? requestId

  // -- Internationalisation --
  if (!pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(req)
    intlResponse.headers.set('x-request-id', requestId)
    intlResponse.headers.set('x-correlation-id', correlationId)
    return intlResponse
  }

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-correlation-id', correlationId)
  return response
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
