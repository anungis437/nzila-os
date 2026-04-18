import { auth } from '@nzila/platform-auth/entra/config'
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@nzila/os-core/rateLimit";
import { checkOrgRateLimit, orgRateLimitHeaders } from "@nzila/os-core/orgRateLimit";

/* ── Public paths ── */
const publicPaths = [
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/webhooks',
  '/api/health',
  '/about',
  '/features',
  '/pricing',
  '/contact',
  '/trial',
]

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true
  return publicPaths.some(p => pathname.startsWith(p))
}

const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? "120");
const RATE_LIMIT_WINDOW_MS = Number(
  process.env.RATE_LIMIT_WINDOW_MS ?? "60000",
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxy = auth((req: any) => {
  const { pathname } = req.nextUrl

  /* ── Layer 2 — Rate limiting (skip in dev — HMR triggers too many requests) ── */
  if (process.env.NODE_ENV !== "development") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const rl = checkRateLimit(ip, {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too Many Requests" },
        {
          status: 429,
          headers: rateLimitHeaders(rl, RATE_LIMIT_MAX),
        },
      );
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

  /* ── Layer 3 — Auth protection ── */
  if (!isPublicPath(pathname) && !req.auth) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  /* ── Layer 3b — Org-scoped rate limiting (per-org + route-group buckets) ── */
  if (process.env.NODE_ENV !== "development") {
    const orgId = req.headers.get("x-org-id");
    if (orgId && pathname.startsWith("/api")) {
      const orgRl = checkOrgRateLimit(
        orgId,
        pathname,
        req.method,
      );
      if (!orgRl.allowed) {
        return NextResponse.json(
          {
            error: "Org Rate Limit Exceeded",
            message: `Rate limit exceeded for route group: ${orgRl.routeGroup}`,
            code: "ORG_RATE_LIMIT_EXCEEDED",
          },
          {
            status: 429,
            headers: orgRateLimitHeaders(orgRl),
          },
        );
      }
    }
  }

  /* ── Layer 4 — Request-ID propagation ── */
  const requestId =
    req.headers.get("x-request-id") ?? crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);
  return response;
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
