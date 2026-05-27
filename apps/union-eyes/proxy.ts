/**
 * Next.js Edge Middleware — implementation module.
 *
 * This file contains the full edge-safe middleware stack for UnionEyes.
 * It is intentionally named `proxy.ts` rather than `middleware.ts` to signal
 * that this layer acts as an edge proxy (intercepts, inspects, and
 * forwards/rejects requests) and to allow it to be imported and tested
 * independently of Next.js framework conventions.
 *
  * NEXT.JS ENTRYPOINT:
  * Next.js requires the middleware entrypoint to be named `middleware.ts` at
  * the application root and to export a function named `middleware` (or
  * `default`). That thin entrypoint lives in `middleware.ts` and simply
  * re-exports from this file (added as T-001 — see commit f641b5487):
  *
  *   export { proxy as middleware, config } from './proxy';
 *
 * MIDDLEWARE STACK (in execution order):
 * ================================
 *
 * 1. Request-ID propagation (x-request-id header for distributed tracing)
 * 2. Public API route pass-through (CORS headers for allowed origins)
 * 3. Cron authentication (x-cron-secret header validation)
 * 4. Idempotency-Key enforcement (auto-inject + warn for mutating requests)
 * 5. Org-scoped rate limiting (per-org + route-group buckets via os-core)
 * 6. IP-based rate limiting for /api/auth endpoints (brute-force protection)
 * 7. Static file pass-through
 * 8. Payment redirect cleanup (strips checkout/payment_intent params)
 * 9. Auth path pass-through (skip i18n for /sign-in, /api/auth, etc.)
 * 10. Marketing path pass-through (/, /story, /pricing, etc.)
 * 11. Locale alias normalisation (/en → /en-CA, /fr → /fr-CA, 308 redirect)
 * 12. i18n locale routing (next-intl)
 *
 * APPLICATION MIDDLEWARE LAYERS (NOT in this file):
 * ================================
 *
 * Layer 2: Database RLS Context (lib/db/with-rls-context.ts)
 * - Sets PostgreSQL session variables for Row-Level Security enforcement
 * - Transaction-scoped; runs inside API routes and server actions
 *
 * Layer 3: Application Authorization (lib/auth.ts)
 * - RBAC, organization membership checks, permission validation
 * - Runs inside business logic via withApi() and server-side layouts
 *
 * See: docs/security/RLS_AUTH_RBAC_ALIGNMENT.md for complete architecture
 */

import { createRouteMatcher } from '@nzila/platform-auth/entra/server';
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createIntlMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/locales';
import { CRON_API_ROUTES, isPublicRoute as isPublicApiRoute } from './lib/public-routes';
import { checkOrgRateLimit, orgRateLimitHeaders } from '@nzila/os-core/orgRateLimit';
import { checkRateLimit, RATE_LIMITS } from './lib/rate-limiter';

// Edge-safe logger — os-core's createLogger uses Node.js APIs (process.stdout,
// node:crypto, node:async_hooks) that are unavailable on the Edge Runtime.
// Uses the shared client-logger which works in Edge/browser runtimes.
// In production, console-wrapper.ts intercepts and routes to Sentry.
import { createClientLogger } from '@/lib/client-logger';

const logger = createClientLogger('middleware');

// ---------------------------------------------------------------------------
// os-core telemetry – request-id propagation  (Edge-safe)
// ---------------------------------------------------------------------------
// The full createRequestContext() from @nzila/os-core/telemetry uses Node.js
// APIs (AsyncLocalStorage, node:crypto) that are unavailable on the Edge
// runtime. Instead, the middleware sets a lightweight `x-request-id` header
// on every response so downstream API routes (running on Node.js) can call
// createRequestContext(req) and pick it up automatically.
// ---------------------------------------------------------------------------
function ensureRequestId(req: Pick<NextRequest, 'headers'>): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID();
}

/** Attach telemetry headers to an outgoing response. */
function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set('x-request-id', requestId);
  return response;
}

/**
 * Extract the real client IP from the request, respecting common proxy headers.
 *
 * Header priority (most-specific to least-specific):
 *   cf-connecting-ip  — Cloudflare's verified single-IP header
 *   x-real-ip         — nginx / generic reverse-proxy single-IP header
 *   x-forwarded-for   — standard hop-list; take the first (leftmost) value
 *
 * Falls back to 'unknown' when no IP header is present (e.g. direct Edge
 * Runtime invocations in test environments).
 */
function getClientIp(req: Pick<NextRequest, 'headers'>): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

const _isProtectedRoute = createRouteMatcher([
  "/:locale/dashboard(.*)"
]);

const _isPublicRoute = createRouteMatcher([
  "/",
  "/:locale",
  "/login(.*)",
  "/signup(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/forgot-password(.*)",
  "/reset-password(.*)",
  "/magic-link(.*)",
  "/invite(.*)",
  "/:locale/login(.*)",
  "/:locale/signup(.*)",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/:locale/forgot-password(.*)",
  "/:locale/reset-password(.*)",
  "/:locale/magic-link(.*)",
  "/:locale/invite(.*)",
  // Marketing pages (no locale prefix)
  "/story(.*)",
  "/pricing(.*)",
  "/contact(.*)",
  "/status(.*)",
  "/case-studies(.*)",
  "/pilot-request(.*)",
  "/features(.*)",
  "/trust(.*)",
  // Locale-prefixed marketing pages (e.g. /fr-CA/story, /en-CA/pricing)
  "/:locale/story(.*)",
  "/:locale/pricing(.*)",
  "/:locale/contact(.*)",
  "/:locale/status(.*)",
  "/:locale/case-studies(.*)",
  "/:locale/pilot-request(.*)",
  "/:locale/features(.*)",
  "/:locale/trust(.*)",
  // Legal pages
  "/legal(.*)",
  "/:locale/legal(.*)",
]);

// Auth pages — skip intl redirect for them
const isAuthPath = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login(.*)",
  "/signup(.*)",
  "/forgot-password(.*)",
  "/reset-password(.*)",
  "/magic-link(.*)",
  "/invite(.*)",
  "/api/auth(.*)",
]);

// Marketing / public pages live at root (no locale prefix).
// They use (marketing)/layout.tsx with their own SiteNavigation + SiteFooter.
const isMarketingPath = createRouteMatcher([
  "/",
  "/story(.*)",
  "/pricing(.*)",
  "/contact(.*)",
  "/status(.*)",
  "/case-studies(.*)",
  "/pilot-request(.*)",
  "/features(.*)",
  // NOTE: /legal(..) NOT included here — intl middleware must redirect
  // /legal/terms → /en-CA/legal/terms so the [locale] route matches.
]);

// PR #4: Removed duplicate API route lists (now imported from lib/api-auth-guard.ts)
// This ensures single source of truth for route allowlists

// Create i18n middleware
const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true
});

// =============================================================================
// CORS ORIGIN WHITELIST (Security Hardened - Feb 2026)
// =============================================================================
// Allowed origins for CORS requests. Never falls back to wildcard in production.
// Multiple origins can be specified as comma-separated list.
const getAllowedOrigins = (): string[] => {
  const originsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '';
  
  // Development: Allow localhost
  if (process.env.NODE_ENV === 'development') {
    const devOrigins = ['http://localhost:3000', 'http://localhost:3001'];
    return originsEnv ? [...devOrigins, ...originsEnv.split(',').map(o => o.trim())] : devOrigins;
  }
  
  // Production: Require explicit configuration, fail secure
  if (!originsEnv) {
    logger.warn('⚠️  CORS_ALLOWED_ORIGINS not configured - CORS disabled for security');
    return [];
  }
  
  return originsEnv.split(',').map(o => o.trim()).filter(Boolean);
};

const isOriginAllowed = (origin: string | null): boolean => {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
};

// This handles both payment provider use cases from whop-setup.md and stripe-setup.md
async function authMiddleware(req: NextRequest): Promise<NextResponse> {
  try {
  // os-core: generate / forward a request-id for distributed tracing
  const requestId = ensureRequestId(req);

  if (req.nextUrl.pathname.startsWith('/api')) {
    // PR #4: Use centralized public route checker from api-auth-guard.ts
    if (isPublicApiRoute(req.nextUrl.pathname)) {
      const origin = req.headers.get('origin');
      
      // Handle CORS preflight for public API routes
      if (req.method === 'OPTIONS') {
        // Security: Only allow configured origins
        if (origin && isOriginAllowed(origin)) {
          return withRequestId(new NextResponse(null, {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Request-Id',
              'Access-Control-Expose-Headers': 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
              'Access-Control-Max-Age': '86400',
              'Vary': 'Origin',
            },
          }), requestId);
        }
        // Reject disallowed origins
        return withRequestId(new NextResponse(null, { status: 403 }), requestId);
      }

      const response = NextResponse.next();
      // Security: Only set CORS headers for allowed origins
      if (origin && isOriginAllowed(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
        response.headers.set('Vary', 'Origin');
      }
      return withRequestId(response, requestId);
    }

    // PR #4: Check cron routes using centralized CRON_API_ROUTES
    if (CRON_API_ROUTES.has(req.nextUrl.pathname)) {
      const cronSecret = process.env.CRON_SECRET || "";
      const providedSecret = req.headers.get("x-cron-secret") || "";
      if (!cronSecret || cronSecret !== providedSecret) {
        return withRequestId(new NextResponse("Unauthorized", { status: 401 }), requestId);
      }
      return withRequestId(NextResponse.next(), requestId);
    }

    // For API routes: return 401 JSON instead of redirecting/rewriting.
    // auth.protect() in dev mode performs a "dev-browser rewrite" that renders
    // the homepage with locale="auth_<handshake-token>", which 404s.
    // Using auth() directly lets us return a clean 401 JSON response.

    // ── Idempotency-Key enforcement ('IDEMPOTENCY_KEY_REQUIRED') ────────
    // Warn-and-continue: auto-inject a generated key for requests missing
    // the header so the request flows through. Logs a warning for gradual
    // migration of client-side fetch calls.
    if (process.env.NODE_ENV !== 'development') {
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        !req.nextUrl.pathname.startsWith('/api/auth') &&
        !req.nextUrl.pathname.startsWith('/api/webhooks') &&
        !req.nextUrl.pathname.startsWith('/api/health') &&
        !req.nextUrl.pathname.startsWith('/api/cron')
      ) {
        if (!req.headers.get('idempotency-key')) {
          logger.warn(`Missing Idempotency-Key header on ${req.method} ${req.nextUrl.pathname}`);
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set('idempotency-key', `auto-${crypto.randomUUID()}`);
          return withRequestId(
            NextResponse.next({ request: { headers: requestHeaders } }),
            requestId,
          );
        }
      }
    }

    // API auth enforcement moved to route handlers / RLS context layer.
    // Edge middleware's crypto.subtle fails with OpenSSL 3 OperationError
    // on Azure Container Apps; auth() in API routes runs on Node.js.

    // ── Org-scoped rate limiting (per-org + route-group buckets) ─────────
    if (process.env.NODE_ENV !== 'development') {
      const orgId = req.headers.get('x-org-id');
      if (orgId && req.nextUrl.pathname.startsWith('/api')) {
        const orgRl = checkOrgRateLimit(
          orgId,
          req.nextUrl.pathname,
          req.method,
        );
        if (!orgRl.allowed) {
          return withRequestId(NextResponse.json(
            {
              error: 'Org Rate Limit Exceeded',
              message: `Rate limit exceeded for route group: ${orgRl.routeGroup}`,
              code: 'ORG_RATE_LIMIT_EXCEEDED',
            },
            {
              status: 429,
              headers: orgRateLimitHeaders(orgRl),
            },
          ), requestId);
        }
      }

      // ── IP-based rate limiting for auth endpoints (brute-force protection) ──
      // Auth endpoints never carry an x-org-id header (no session yet), so the
      // org rate-limit block above does not apply to them. This block provides
      // per-IP protection against credential stuffing and brute-force attacks.
      // NOTE: match '/api/auth/' (with slash) to avoid catching '/api/auth_core/...'
      // NOTE: skip in CI — test suites hit auth routes from a single IP and exhaust
      //       the 20-req/15-min bucket; brute-force protection is not needed in CI.
      if (
        !process.env.CI &&
        (req.nextUrl.pathname.startsWith('/api/auth/') || req.nextUrl.pathname === '/api/auth')
      ) {
        const clientIp = getClientIp(req);
        try {
          const ipRl = await checkRateLimit(
            `ip:${clientIp}`,
            RATE_LIMITS.AUTH_IP,
          );
          if (!ipRl.allowed) {
            logger.warn('Auth endpoint IP rate limit exceeded', {
              ip: clientIp,
              pathname: req.nextUrl.pathname,
              requestId,
            });
            return withRequestId(NextResponse.json(
              {
                error: 'Too Many Requests',
                message: 'Authentication rate limit exceeded. Please try again later.',
                code: 'AUTH_IP_RATE_LIMIT_EXCEEDED',
                retryAfter: ipRl.resetIn,
              },
              {
                status: 429,
                headers: {
                  'Retry-After': String(ipRl.resetIn),
                  'X-RateLimit-Limit': String(ipRl.limit),
                  'X-RateLimit-Remaining': String(ipRl.remaining),
                  'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + ipRl.resetIn),
                },
              },
            ), requestId);
          }
        } catch (rlError) {
          // Rate limit check failure must not block legitimate auth traffic.
          // Log for monitoring but allow the request through.
          logger.error('Auth IP rate limit check failed — allowing request', {
            ip: clientIp,
            pathname: req.nextUrl.pathname,
            error: (rlError as Error).message,
            requestId,
          });
        }
      }
    }

    return withRequestId(NextResponse.next(), requestId);
  }

  // Skip middleware for static files
  if (req.nextUrl.pathname.startsWith('/_next') ||
      req.nextUrl.pathname.includes('.')) {
    return withRequestId(NextResponse.next(), requestId);
  }
  
  // Check for problematic URLs that might cause 431 errors
  // This covers payment provider redirects ONLY.
  // NOTE: __clerk_handshake must NOT be stripped — the auth provider uses it to refresh
  // short-lived session JWTs. Stripping it breaks session refresh and forces
  // authenticated users back to the sign-in page.
  if (
    req.nextUrl.search && (
      req.nextUrl.search.includes('payment_intent') ||
      req.nextUrl.search.includes('checkout_id') ||
      req.nextUrl.search.includes('ref=') ||
      req.nextUrl.search.includes('client_reference_id=')
    )
  ) {
    // The URL contains parameters that might cause 431 errors
    // Instead of just letting it pass through, redirect to a clean URL
    // This prevents the accumulation of large cookies
    
    // Restrict redirect targets to safe internal paths only.
    const cleanUrl = req.nextUrl.pathname;
    const safePath = /^\/[a-zA-Z0-9\-._~/]*$/.test(cleanUrl) ? cleanUrl : '/';

    // Create a new URL object based on the current request (same-origin redirect)
    const url = new URL(safePath, req.nextUrl.origin);
    
    // Important: Add a small cache-busting parameter to ensure the browser doesn't use cached data
    // This helps avoid cookie-related issues without adding significant query string size
    url.searchParams.set('cb', Date.now().toString().slice(-4));
    
    // Return a redirect response to the clean URL (same-origin)
    const location = `${url.pathname}?${url.searchParams.toString()}`;
    const redirectResponse = new NextResponse(null, {
      status: 307,
      headers: { location },
    });
    return withRequestId(redirectResponse, requestId);
  }

  // Auth enforcement moved to server-side layouts (dashboard/layout.tsx,
  // portal/layout.tsx, admin/layout.tsx) which run on Node.js.
  // Edge middleware's crypto.subtle fails with OpenSSL 3 OperationError
  // on Azure Container Apps; server components use Node.js native crypto.
  
  // Auth paths (/sign-in, /sign-up, /api/auth) must NOT be locale-redirected.
  if (isAuthPath(req)) {
    return withRequestId(NextResponse.next(), requestId);
  }

  // Marketing pages live at root without locale prefix (/, /story, /pricing, etc.)
  // They use (marketing)/layout.tsx — skip intl redirect so visitors land directly.
  if (isMarketingPath(req)) {
    return withRequestId(NextResponse.next(), requestId);
  }

  // ── R5: Locale alias normalization (single-hop, deterministic) ──────────
  // Configured locales are en-CA / fr-CA / it / pt. Short aliases /en and /fr
  // (without the -CA region tag) are NOT in the locale list, which causes
  // next-intl to treat them as non-prefixed paths and prepend the default
  // locale — producing the double-prefix /en-CA/en/X. We normalize here with
  // a single 308 (permanent, method-preserving) redirect to the canonical
  // regional locale. Bounded: at most one redirect; never recursive.
  const _localeAliasMap: Readonly<Record<string, string>> = Object.freeze({
    en: 'en-CA',
    fr: 'fr-CA',
  });
  const _firstSegment = req.nextUrl.pathname.split('/')[1] ?? '';
  const _aliasTarget = _localeAliasMap[_firstSegment];
  if (_aliasTarget) {
    const _normalized = req.nextUrl.pathname.replace(
      new RegExp(`^/${_firstSegment}(?=/|$)`),
      `/${_aliasTarget}`,
    );
    const _url = req.nextUrl.clone();
    _url.pathname = _normalized;
    return withRequestId(NextResponse.redirect(_url, 308), requestId);
  }

  // For non-API routes, run i18n middleware and return its response
  const intlResponse = intlMiddleware(req);
  // intlMiddleware returns a Response; wrap it so we can attach our header
  if (intlResponse instanceof NextResponse) {
    return withRequestId(intlResponse, requestId);
  }
  // Fallback: convert plain Response to NextResponse to set headers
  const nr = NextResponse.next({ headers: new Headers((intlResponse as Response).headers) });
  nr.headers.set('x-request-id', requestId);
  return nr;
  } catch (middlewareError) {
    // Log error for debugging — this catch prevents silent 500s
    logger.error('[middleware] Unhandled error:', { error: middlewareError });
    return new NextResponse(
      JSON.stringify({ error: 'Middleware error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

// Export the auth middleware directly
export async function proxy(req: NextRequest): Promise<NextResponse> {
  try {
    return await authMiddleware(req);
  } catch (outerError) {
    const eLogger = createClientLogger('middleware');
    eLogger.error('[middleware] Outer error:', { error: outerError });
    return new NextResponse(
      JSON.stringify({ error: 'Middleware error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files, but match everything else
    '/((?!_next/static|_next/image|_vercel|favicon.ico|.*\\..*).*)' 
  ]
};
