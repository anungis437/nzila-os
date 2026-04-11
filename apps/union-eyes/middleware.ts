/**
 * Next.js Edge Middleware
 * 
 * MIDDLEWARE STACK ARCHITECTURE:
 * ================================
 * 
 * This application uses a multi-layer middleware approach for security and isolation:
 * 
 * Layer 1: Edge Middleware (THIS FILE)
 * - Runs on Vercel Edge/Cloudflare network before request reaches application
 * - Responsibilities:
 *   1. Platform authentication (JWT validation, session management)
 *   2. i18n localization routing
 *   3. Route protection (public vs protected routes)
 *   4. Webhook authentication (cron, Stripe webhooks)
 * - Sets: userId, orgId, sessionClaims in request context
 * 
 * Layer 2: Database RLS Context (lib/db/with-rls-context.ts)
 * - Runs inside API routes and server actions
 * - Responsibilities:
 *   1. Sets PostgreSQL session variables (app.current_user_id)
 *   2. Enables Row-Level Security enforcement
 *   3. Transaction-scoped isolation (prevents context leakage)
 * - Usage: Wrap all database operations in withRLSContext()
 * 
 * Layer 3: Application Authorization (lib/auth.ts)
 * - Runs inside business logic
 * - Responsibilities:
 *   1. Role-based access control (RBAC)
 *   2. Organization membership checks
 *   3. Permission validation
 * - Functions: hasRole(), isSystemAdmin(), hasRoleInOrganization()
 * 
 * COORDINATION:
 * - Edge middleware authenticates user via platform auth
 * - RLS middleware sets database context using authenticated user ID
 * - RLS policies enforce row-level security automatically
 * - Application code can add additional authorization checks as needed
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
  "/:locale/login(.*)",
  "/:locale/signup(.*)",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/:locale/forgot-password(.*)",
  "/:locale/reset-password(.*)",
  // Marketing pages (no locale prefix)
  "/story(.*)",
  "/pricing(.*)",
  "/contact(.*)",
  "/status(.*)",
  "/case-studies(.*)",
  "/pilot-request(.*)",
  "/features(.*)",
  // Locale-prefixed marketing pages (e.g. /fr-CA/story, /en-CA/pricing)
  "/:locale/story(.*)",
  "/:locale/pricing(.*)",
  "/:locale/contact(.*)",
  "/:locale/status(.*)",
  "/:locale/case-studies(.*)",
  "/:locale/pilot-request(.*)",
  "/:locale/features(.*)",
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
    
    // Extract the base URL path without query parameters (same-origin only)
    const cleanUrl = req.nextUrl.pathname;
    
    // Create a new URL object based on the current request (same-origin redirect)
    const url = new URL(cleanUrl, req.url);
    
    // Ensure the redirect stays on the same origin to prevent open-redirect attacks
    if (url.origin !== new URL(req.url).origin) {
      return withRequestId(NextResponse.next(), requestId);
    }
    
    // Important: Add a small cache-busting parameter to ensure the browser doesn't use cached data
    // This helps avoid cookie-related issues without adding significant query string size
    url.searchParams.set('cb', Date.now().toString().slice(-4));
    
    // Return a redirect response to the clean URL (same-origin)
    return withRequestId(NextResponse.redirect(url), requestId);
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
      JSON.stringify({ error: 'Middleware error', message: String(middlewareError) }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}

// Export the auth middleware directly
export default async function middleware(req: NextRequest): Promise<NextResponse> {
  try {
    return await authMiddleware(req);
  } catch (outerError) {
    const eLogger = createClientLogger('middleware');
    eLogger.error('[middleware] Outer error:', { error: outerError });
    return new NextResponse(
      JSON.stringify({ error: 'Middleware error', message: String(outerError) }),
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
