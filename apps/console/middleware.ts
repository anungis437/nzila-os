import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@nzila/os-core/rateLimit'
import { checkOrgRateLimit, orgRateLimitHeaders } from '@nzila/os-core/orgRateLimit'
import createIntlMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from './lib/locales'

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
  localeDetection: true,
})

const publicPaths = ['/', '/sign-in', '/sign-up', '/api/webhooks', '/api/health', '/api/auth']

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default auth((request: any) => {
  // ── Legacy route redirects (entity → org migration) ──────────────────
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/business/orgs')) {
    const newPath = pathname.replace(/^\/business\/orgs/, '/orgs')
    const url = request.nextUrl.clone()
    url.pathname = newPath
    return NextResponse.redirect(url, 308)
  }
  // Legacy /api/entities → /api/orgs redirect
  if (pathname.startsWith('/api/entities')) {
    const newPath = pathname.replace(/^\/api\/entities/, '/api/orgs')
    const url = request.nextUrl.clone()
    url.pathname = newPath
    return NextResponse.redirect(url, 308)
  }

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

  // ── Org-scoped rate limiting (per-org + route-group buckets) ────────
  if (process.env.NODE_ENV !== 'development') {
    const orgId = request.headers.get('x-org-id')
    if (orgId && request.nextUrl.pathname.startsWith('/api')) {
      const orgRl = checkOrgRateLimit(
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

  // ── Cost budget enforcement (denial-of-wallet) ────────────────────────
  // In pilot/prod: check org budget before allowing non-exempt routes.
  // Edge-safe: uses in-memory budget cache with periodic refresh.
  if (
    process.env.NODE_ENV !== 'development' &&
    request.nextUrl.pathname.startsWith('/api')
  ) {
    const orgId = request.headers.get('x-org-id')
    if (orgId) {
      const budgetExemptRoutes = ['/api/admin/', '/api/export/', '/api/proof/', '/api/health']
      const isExempt = budgetExemptRoutes.some((r) => request.nextUrl.pathname.startsWith(r))
      if (!isExempt) {
        const budgetState = request.headers.get('x-budget-state')
        if (budgetState === 'exceeded') {
          return NextResponse.json(
            {
              error: 'Budget Exceeded',
              message: 'Org has exceeded its cost budget. Admin, export, and proof endpoints remain accessible.',
              code: 'COST_BUDGET_EXCEEDED',
            },
            { status: 402 },
          )
        }
      }
    }
  }

  // ── Sovereign egress enforcement (block unapproved outbound hosts) ──
  // When SOVEREIGN_EGRESS_ENFORCED=true, integration/webhook API routes
  // must declare a target host via x-egress-host header, which is checked
  // against the allowlist.
  if (
    process.env.SOVEREIGN_EGRESS_ENFORCED === 'true' &&
    request.nextUrl.pathname.startsWith('/api') &&
    (request.nextUrl.pathname.includes('/integrations') ||
      request.nextUrl.pathname.includes('/webhooks') ||
      request.nextUrl.pathname.includes('/connect'))
  ) {
    const targetHost = request.headers.get('x-egress-host')
    if (targetHost) {
      const allowed = (process.env.SOVEREIGN_EGRESS_ALLOWLIST ?? '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
      const normalised = targetHost.toLowerCase().trim()
      if (!allowed.includes(normalised) && !allowed.some((a) => a.startsWith('*.') && (normalised === a.slice(2) || normalised.endsWith(`.${a.slice(2)}`)))) {
        return NextResponse.json(
          {
            error: 'Egress Blocked',
            message: `Outbound host "${targetHost}" is not in the sovereign egress allowlist.`,
            code: 'SOVEREIGN_EGRESS_BLOCKED',
          },
          { status: 403 },
        )
      }
    }
  }

  // ── Authentication ────────────────────────────────────────────────────
  // Auth enforcement moved to server-side layouts ((dashboard)/layout.tsx)
  // which run on Node.js. Edge middleware's crypto.subtle fails with
  // OpenSSL 3 OperationError on Azure Container Apps; server components
  // use Node.js native crypto which works correctly.

  // ── Request-ID + Correlation-ID propagation ───────────────────────────
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const correlationId = request.headers.get('x-correlation-id') ?? requestId

  // ── i18n locale detection (cookie / Accept-Language) ─────────────────
  if (!request.nextUrl.pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(request)
    const response = NextResponse.next({
      request: { headers: new Headers(request.headers) },
    })
    intlResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-correlation-id', correlationId)
    return response
  }

  const response = NextResponse.next()
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-correlation-id', correlationId)
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
