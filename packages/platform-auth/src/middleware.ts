/**
 * @nzila/platform-auth — Middleware Helpers
 *
 * Shared middleware factories for Next.js apps.
 * Apps can import and configure these instead of writing
 * their own authMiddleware wrappers.
 */

// ── Public Route Matcher ────────────────────────────────────────────────────

/**
 * Create a route matcher function for public routes.
 * These routes bypass auth protection.
 */
export function createPublicRouteMatcher(
  patterns: Array<string | RegExp>,
): (pathname: string) => boolean {
  const compiled = patterns.map(p => {
    if (p instanceof RegExp) return p
    // Convert glob-like patterns to regex
    const escaped = p
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*')
    return new RegExp(`^${escaped}$`)
  })

  return (pathname: string) => compiled.some(re => re.test(pathname))
}

// ── Common Public Routes ────────────────────────────────────────────────────

/** Standard public route patterns shared across all Nzila OS apps. */
export const COMMON_PUBLIC_ROUTES: Array<string | RegExp> = [
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/webhooks(.*)',
  '/_next(.*)',
  '/favicon.ico',
]

// ── Org Header Resolver ─────────────────────────────────────────────────────

/**
 * Resolve org ID from request headers (for internal API calls).
 * Header name: x-org-id
 */
export function resolveOrgFromHeader(
  headers: Headers,
): string | undefined {
  return headers.get('x-org-id') ?? undefined
}

/**
 * Resolve request correlation ID from headers or generate one.
 */
export function resolveCorrelationId(
  headers: Headers,
): string {
  return (
    headers.get('x-correlation-id') ??
    headers.get('x-request-id') ??
    crypto.randomUUID()
  )
}

// ── Module ID Injection ─────────────────────────────────────────────────────

/**
 * Create headers with platform context for inter-service calls.
 */
export function createPlatformHeaders(
  ctx: {
    orgId?: string
    correlationId?: string
    moduleId?: string
    actorId?: string
  },
): Record<string, string> {
  const headers: Record<string, string> = {}
  if (ctx.orgId) headers['x-org-id'] = ctx.orgId
  if (ctx.correlationId) headers['x-correlation-id'] = ctx.correlationId
  if (ctx.moduleId) headers['x-module-id'] = ctx.moduleId
  if (ctx.actorId) headers['x-actor-id'] = ctx.actorId
  return headers
}
