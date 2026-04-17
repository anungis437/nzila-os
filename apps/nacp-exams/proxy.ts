/**
 * NACP Exams — Edge Middleware
 *
 * 4-layer stack (aligned with console reference + i18n):
 *   Layer 1: Edge  — Rate limiting (skip in dev)
 *   Layer 2: Edge  — Entra ID auth (NextAuth.js)
 *   Layer 3: Edge  — i18n routing (next-intl)
 *   Layer 4: Edge  — Request-ID propagation
 */

import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'
import { locales, defaultLocale } from './lib/locales'

// ── Request-ID propagation (Edge-safe) ──────────────────────────────────────

function ensureRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID()
}

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId)
  return response
}

// ── Public paths ────────────────────────────────────────────────────────────

const publicPaths = [
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/health',
  '/api/webhooks',
  '/about',
  '/pricing',
  '/contact',
  '/demo-request',
]

const authPaths = ['/sign-in', '/sign-up']

const marketingPaths = ['/', '/about', '/pricing', '/contact', '/demo-request']

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return publicPaths.some(p => pathname.startsWith(p))
    || /^\/[a-z]{2}(-[A-Z]{2})?\/?$/.test(pathname) // /:locale root
    || /^\/[a-z]{2}(-[A-Z]{2})?\/sign-(in|up)/.test(pathname) // /:locale/sign-in/up
}

function isAuthPath(pathname: string): boolean {
  return authPaths.some(p => pathname.startsWith(p))
}

function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true
  return marketingPaths.some(p => p !== '/' && pathname.startsWith(p))
}

// ── i18n middleware ─────────────────────────────────────────────────────────

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true,
})

// ── Rate limiting ───────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

// ── Main middleware ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth((req: any) => {
  const requestId = ensureRequestId(req)
  const { pathname } = req.nextUrl

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

  // ── Auth protection — redirect unauthenticated users ──────────────────
  if (!isPublicPath(pathname) && !req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // API routes — pass through after auth check
  if (pathname.startsWith('/api')) {
    return withRequestId(NextResponse.next(), requestId)
  }

  // Static files
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return withRequestId(NextResponse.next(), requestId)
  }

  // Skip intl for auth paths (prevent redirect loops)
  if (isAuthPath(pathname)) {
    return withRequestId(NextResponse.next(), requestId)
  }

  // Skip intl for marketing pages (root paths, no locale prefix)
  if (isMarketingPath(pathname)) {
    return withRequestId(NextResponse.next(), requestId)
  }

  // Run i18n middleware for locale-prefixed routes
  const intlResponse = intlMiddleware(req)
  if (intlResponse instanceof NextResponse) {
    return withRequestId(intlResponse, requestId)
  }
  const nr = NextResponse.next({ headers: new Headers((intlResponse as Response).headers) })
  nr.headers.set('x-request-id', requestId)
  return nr
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
