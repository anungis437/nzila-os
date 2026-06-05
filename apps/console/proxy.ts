import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
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

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? '120')
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? '60000')
type ProxyRequest = NextRequest & { auth?: unknown }

export const proxy = auth((request: unknown) => {
  const req = request as ProxyRequest
  // ── Legacy route redirects (entity → org migration) ──────────────────
  const pathname = req.nextUrl.pathname
  if (pathname.startsWith('/business/orgs')) {
    const newPath = pathname.replace(/^\/business\/orgs/, '/orgs')
    if (newPath.startsWith('/')) {
      return NextResponse.rewrite(new URL(newPath, req.url))
    }
  }
  // Legacy /api/entities → /api/orgs redirect
  if (pathname.startsWith('/api/entities')) {
    const newPath = pathname.replace(/^\/api\/entities/, '/api/orgs')
    if (newPath.startsWith('/')) {
      return NextResponse.rewrite(new URL(newPath, req.url))
    }
  }

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

  // ── Org-scoped rate limiting (per-org + route-group buckets) ────────
  if (process.env.NODE_ENV !== 'development') {
    const orgId = req.headers.get('x-org-id')
    if (orgId && req.nextUrl.pathname.startsWith('/api')) {
      const orgRl = checkOrgRateLimit(orgId, req.nextUrl.pathname, req.method)
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

  // ── Cost budget enforcement (denial-of-wallet) ────────────────────────
  if (process.env.NODE_ENV !== 'development' && req.nextUrl.pathname.startsWith('/api')) {
    const orgId = req.headers.get('x-org-id')
    if (orgId) {
      const budgetExemptRoutes = ['/api/admin/', '/api/export/', '/api/proof/', '/api/health']
      const isExempt = budgetExemptRoutes.some((r) => req.nextUrl.pathname.startsWith(r))
      if (!isExempt) {
        const budgetState = req.headers.get('x-budget-state')
        if (budgetState === 'exceeded') {
          return NextResponse.json(
            {
              error: 'Budget Exceeded',
              message:
                'Org has exceeded its cost budget. Admin, export, and proof endpoints remain accessible.',
              code: 'COST_BUDGET_EXCEEDED',
            },
            { status: 402 },
          )
        }
      }
    }
  }

  // ── Sovereign egress enforcement (block unapproved outbound hosts) ──
  if (
    process.env.SOVEREIGN_EGRESS_ENFORCED === 'true' &&
    req.nextUrl.pathname.startsWith('/api') &&
    (req.nextUrl.pathname.includes('/integrations') ||
      req.nextUrl.pathname.includes('/webhooks') ||
      req.nextUrl.pathname.includes('/connect'))
  ) {
    const targetHost = req.headers.get('x-egress-host')
    if (targetHost) {
      const allowed = (process.env.SOVEREIGN_EGRESS_ALLOWLIST ?? '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean)
      const normalised = targetHost.toLowerCase().trim()
      if (
        !allowed.includes(normalised) &&
        !allowed.some(
          (a) =>
            a.startsWith('*.') &&
            (normalised === a.slice(2) || normalised.endsWith(`.${a.slice(2)}`)),
        )
      ) {
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

  // ── Request-ID + Correlation-ID propagation ───────────────────────────
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
  const correlationId = req.headers.get('x-correlation-id') ?? requestId

  // ── i18n locale detection (cookie / Accept-Language) ─────────────────
  if (!req.nextUrl.pathname.startsWith('/api')) {
    const intlResponse = intlMiddleware(req)
    const response = NextResponse.next({
      request: { headers: new Headers(req.headers) },
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
