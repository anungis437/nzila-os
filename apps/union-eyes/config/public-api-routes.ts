/**
 * Public API Routes Configuration
 * 
 * Explicit allowlist of API routes that do NOT require authentication.
 * Every route in this list MUST have a justification comment.
 * 
 * @module config/public-api-routes
 */

export interface PublicRouteConfig {
  /** Route pattern (supports wildcards: * and [param]) */
  pattern: string;
  /** Human-readable justification for why this route is public */
  reason: string;
  /** Category for grouping */
  category: 'health' | 'webhook' | 'public-content' | 'tracking' | 'payment' | 'dev-only';
}

/**
 * Comprehensive list of public API routes with justifications
 */
export const PUBLIC_API_ROUTES: PublicRouteConfig[] = [
  // ========== HEALTH & MONITORING ==========
  {
    pattern: '/api/health',
    reason: 'System health check for load balancers and monitoring',
    category: 'health',
  },
  {
    pattern: '/api/health/liveness',
    reason: 'Kubernetes liveness probe endpoint',
    category: 'health',
  },
  {
    pattern: '/api/status',
    reason: 'Public system status page',
    category: 'health',
  },
  {
    pattern: '/api/docs/openapi.json',
    reason: 'OpenAPI documentation (public spec)',
    category: 'public-content',
  },
  
  // ========== WEBHOOKS (signature-verified) ==========
  {
    pattern: '/api/webhooks/stripe',
    reason: 'Stripe webhook receiver (authenticates via signature header)',
    category: 'webhook',
  },
  {
    pattern: '/api/webhooks/clc',
    reason: 'CLC webhook receiver (authenticates via signature header)',
    category: 'webhook',
  },
  {
    pattern: '/api/webhooks/signatures',
    reason: 'Generic signature webhook receiver',
    category: 'webhook',
  },
  {
    pattern: '/api/webhooks/whop',
    reason: 'Whop webhook receiver (authenticates via signature header)',
    category: 'webhook',
  },
  {
    pattern: '/api/signatures/webhooks/docusign',
    reason: 'DocuSign webhook receiver (authenticates via signature header)',
    category: 'webhook',
  },
  {
    pattern: '/api/integrations/shopify/webhooks',
    reason: 'Shopify webhook receiver (authenticates via signature header)',
    category: 'webhook',
  },
  {
    pattern: '/api/payments/webhooks/stripe',
    reason: 'Stripe webhook endpoint (authenticates via signature header)',
    category: 'webhook',
  },
  {
    pattern: '/api/whop/webhooks',
    reason: 'Whop webhook alt endpoint (authenticates via signature header)',
    category: 'webhook',
  },
  
  // ========== PUBLIC CHECKOUT / PAYMENT ==========
  {
    pattern: '/api/whop/unauthenticated-checkout',
    reason: 'Public checkout flow for non-authenticated users',
    category: 'payment',
  },
  {
    pattern: '/api/whop/create-checkout',
    reason: 'Public checkout creation endpoint',
    category: 'payment',
  },
  
  // ========== PUBLIC TRACKING / ANALYTICS ==========
  {
    pattern: '/api/communications/track/open/*',
    reason: 'Email open tracking (1x1 pixel, no sensitive data)',
    category: 'tracking',
  },
  {
    pattern: '/api/communications/track/click',
    reason: 'Email link click tracking (no sensitive data)',
    category: 'tracking',
  },
  {
    pattern: '/api/communications/unsubscribe/*',
    reason: 'Email unsubscribe endpoint (requires unsubscribe token)',
    category: 'tracking',
  },
  
  // ========== DEV / TEST ONLY (remove in production) ==========
  {
    pattern: '/api/sentry-example-api',
    reason: 'Sentry test endpoint (DEV ONLY - should be removed in production)',
    category: 'dev-only',
  },
];

/**
 * CRON job routes that authenticate via secret header
 * These are internal scheduled tasks, not public, but authenticate differently
 */
export const CRON_API_ROUTES: PublicRouteConfig[] = [
  {
    pattern: '/api/cron/analytics/daily-metrics',
    reason: 'Daily analytics aggregation cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
  {
    pattern: '/api/cron/education-reminders',
    reason: 'Education reminder emails cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
  {
    pattern: '/api/cron/monthly-dues',
    reason: 'Monthly dues processing cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
  {
    pattern: '/api/cron/monthly-per-capita',
    reason: 'Monthly per capita calculation cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
  {
    pattern: '/api/cron/overdue-notifications',
    reason: 'Overdue payment notifications cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
  {
    pattern: '/api/cron/scheduled-reports',
    reason: 'Scheduled report generation cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
  {
    pattern: '/api/rewards/cron',
    reason: 'Rewards processing cron job (authenticates via X-Cron-Secret header)',
    category: 'webhook',
  },
];

/**
 * Get all public route patterns (for middleware)
 */
export function getAllPublicRoutes(): string[] {
  return [...PUBLIC_API_ROUTES, ...CRON_API_ROUTES].map(r => r.pattern);
}

/**
 * Check if a route pattern matches a path
 */
export function matchesRoutePattern(pattern: string, path: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\[.*?\]/g, '[^/]+')  // [param] -> [^/]+
    .replace(/\*/g, '.*');          // * -> .*
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Check if a path is in the public allowlist
 */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_API_ROUTES.some(route => matchesRoutePattern(route.pattern, path));
}

/**
 * Check if a path is a cron route
 */
export function isCronRoute(path: string): boolean {
  return CRON_API_ROUTES.some(route => matchesRoutePattern(route.pattern, path));
}

