/**
 * Public Route Constants
 * 
 * This file contains ONLY route definitions and simple helper functions.
 * It has NO dependencies on Node.js modules (crypto, fs, etc.).
 * 
 * Purpose: Allow middleware.ts (Edge runtime) to import route constants
 * without pulling in database or Node.js dependencies.
 * 
 * @module lib/public-routes
 */

/**
 * Public API routes that don&apos;t require authentication
 * 
 * SECURITY DOCUMENTATION:
 * Each route listed here is documented with its justification for being public.
 * Routes marked with '/' suffix are prefix patterns (e.g., '/api/communications/track/' matches all tracking endpoints)
 */
export const PUBLIC_API_ROUTES = new Set([
  // ========================================================================
  // HEALTH CHECKS & MONITORING
  // Justification: Infrastructure monitoring, no sensitive data
  // ========================================================================
  '/api/health',              // Basic health check for uptime monitoring
  '/api/health/liveness',      // Kubernetes liveness probe
  '/api/status',               // System status endpoint for ops dashboards
  '/api/docs/openapi.json',    // Public API documentation (describes public endpoints only)
  
  // ========================================================================
  // WEBHOOKS
  // Justification: External systems push events, authenticated via signatures
  // ========================================================================
  '/api/webhooks/stripe',      // Stripe payment events (verified via webhook signature)
  '/api/webhooks/clc',         // CLC per-capita updates (verified via API key)
  '/api/webhooks/signatures',  // DocuSign signature events (verified via webhook signature)
  '/api/webhooks/whop',        // Whop membership events (verified via webhook signature)
  '/api/signatures/webhooks/docusign', // Legacy DocuSign webhook endpoint
  '/api/integrations/shopify/webhooks', // Shopify order events (verified via HMAC)
  '/api/stripe/webhooks',      // Alternative Stripe webhook endpoint
  '/api/whop/webhooks',        // Alternative Whop webhook endpoint
  
  // ========================================================================
  // PUBLIC CHECKOUT/PAYMENT FLOWS
  // Justification: Guest checkout required for payment processor integrations
  // ========================================================================
  '/api/whop/unauthenticated-checkout', // Guest checkout flow (creates session on success)
  '/api/whop/create-checkout',          // Whop checkout creation (redirects to Whop auth)
  
  // ========================================================================
  // PUBLIC TRACKING/ANALYTICS
  // Justification: Email opens/clicks tracking, must work without auth
  // Note: These use path prefixes - handler validates token in URL
  // ========================================================================
  '/api/communications/track/',    // Email tracking endpoints (token-based auth in URL)
  '/api/communications/unsubscribe/', // Email unsubscribe (token-based)
  
  // ========================================================================
  // DEV/TESTING ENDPOINTS
  // Note: Sentry test endpoint removed for production security
  // ========================================================================

  // ========================================================================
  // DEV DEBUGGING (remove before production)
  // Justification: Must be public so currentUser() resolves via cookie
  // ========================================================================
  '/api/auth/debug-role',      // Role inspection endpoint (dev only)
]);

/**
 * Infrastructure routes with custom authentication
 * 
 * These routes are NOT in PUBLIC_API_ROUTES but use non-standard auth patterns:
 * 
 * /api/metrics - Prometheus metrics endpoint
 *   Auth: METRICS_AUTH_TOKEN via Authorization: Bearer header
 *   Justification: Infrastructure monitoring, token-based auth sufficient
 *   Location: app/api/metrics/route.ts
 *   Security: 401 if token missing/invalid in production
 * 
 * These routes are documented here for security audit purposes but are NOT
 * added to PUBLIC_API_ROUTES since they have authentication requirements.
 */

/**
 * Cron job routes that authenticate via secret header
 * 
 * SECURITY: These routes check X-CRON-SECRET header matches CRON_SECRET env var
 * Justification: Background jobs must run without user authentication
 */
export const CRON_API_ROUTES = new Set([
  '/api/cron/analytics/daily-metrics',  // Daily analytics aggregation
  '/api/cron/education-reminders',      // Send education course reminders
  '/api/cron/monthly-dues',             // Process monthly dues payments
  '/api/cron/monthly-per-capita',       // CLC per-capita reporting
  '/api/cron/overdue-notifications',    // Send overdue claim notifications
  '/api/cron/scheduled-reports',        // Generate scheduled reports
  '/api/rewards/cron',                  // Process rewards point expiration
  '/api/cron/external-data-sync',       // Sync data from external systems
]);

// =============================================================================
// PUBLIC & CRON ROUTE HELPERS
// =============================================================================

/**
 * Check if a route path is public (no authentication required)
 * 
 * @param pathname - The request pathname (e.g., '/api/health')
 * @returns true if the route is public, false if authentication is required
 * 
 * @example
 * ```typescript
 * if (isPublicRoute('/api/health')) {
 *   // Allow without auth
 * }
 * 
 * if (isPublicRoute('/api/communications/track/email/abc123')) {
 *   // Matches prefix pattern '/api/communications/track/'
 * }
 * ```
 */
export function isPublicRoute(pathname: string): boolean {
  // Check exact matches first (most common case)
  if (PUBLIC_API_ROUTES.has(pathname)) {
    return true;
  }
  
  // Check path prefix patterns (routes ending with '/')
  for (const route of PUBLIC_API_ROUTES) {
    if (route.endsWith('/') && pathname.startsWith(route)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a route path is a cron job
 * 
 * @param pathname - The request pathname
 * @returns true if the route is a cron job endpoint
 */
export function isCronRoute(pathname: string): boolean {
  for (const route of CRON_API_ROUTES) {
    if (route.endsWith('/')) {
      if (pathname.startsWith(route)) return true;
    } else {
      if (pathname === route) return true;
    }
  }
  return false;
}
