/**
 * Enhanced Rate Limiting Middleware
 * 
 * Provides convenient wrapper around rate limiting functionality with:
 * - Automatic rate limit header injection
 * - Clear error messages with retry-after
 * - Logging of rate limit violations
 * - Type-safe integration with Next.js route handlers
 * 
 * @example
 * ```typescript
 * import { withRateLimit } from '@/lib/middleware/rate-limit-middleware';
 * import { RATE_LIMITS } from '@/lib/rate-limiter';
 * 
 * export const POST = withRateLimit(
 *   { config: RATE_LIMITS.FINANCIAL_WRITE, keyPrefix: 'user' },
 *   async (request, context) => {
 *     // Your handler logic here
 *     return NextResponse.json({ success: true });
 *   }
 * );
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkRateLimit, 
  checkMultiLayerRateLimit,
  createRateLimitHeaders,
  RateLimitConfig,
  MultiLayerRateLimitConfig 
} from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

/**
 * Context type for route handlers with userId and organizationId
 */
export interface RateLimitContext {
  userId?: string;
  organizationId?: string;
  [key: string]: any;
}

/**
 * Configuration for rate limit middleware
 */
export interface RateLimitMiddlewareConfig {
  /** Rate limit configuration */
  config: RateLimitConfig;
  
  /** Key prefix to use for rate limiting (e.g., 'user', 'org', 'ip') */
  keyPrefix: 'user' | 'org' | 'ip';
  
  /** Custom function to extract the rate limit key from the request */
  extractKey?: (request: NextRequest, context?: RateLimitContext) => string | Promise<string>;
  
  /** Whether to log rate limit violations (default: true) */
  logViolations?: boolean;
  
  /** Custom error message for rate limit exceeded */
  errorMessage?: string;
}

/**
 * Type for Next.js route handler enhanced with context
 */
type RouteHandler<T extends RateLimitContext = RateLimitContext> = (
  request: NextRequest,
  context?: T
) => Promise<NextResponse> | NextResponse;

/**
 * Enhanced rate limiting wrapper for Next.js route handlers
 * 
 * Wraps a route handler with rate limiting logic, automatically:
 * - Checks rate limits before handler execution
 * - Injects rate limit headers into responses
 * - Returns 429 responses with clear error messages
 * - Logs rate limit violations
 * 
 * @param config - Rate limit middleware configuration
 * @param handler - Route handler to wrap with rate limiting
 * @returns Wrapped route handler with rate limiting
 */
export function withRateLimit<T extends RateLimitContext = RateLimitContext>(
  config: RateLimitMiddlewareConfig,
  handler: RouteHandler<T>
): RouteHandler<T> {
  return async (request: NextRequest, context?: T) => {
    try {
      // Extract rate limit key
      let rateLimitKey: string;
      
      if (config.extractKey) {
        rateLimitKey = await config.extractKey(request, context);
      } else {
        // Default key extraction based on prefix
        rateLimitKey = await extractDefaultKey(request, context, config.keyPrefix);
      }

      // Check rate limit
      const rateLimitResult = await checkRateLimit(rateLimitKey, config.config);

      // If rate limit exceeded, return 429 with headers
      if (!rateLimitResult.allowed) {
        // Log violation if enabled
        if (config.logViolations !== false) {
          logger.warn('Rate limit exceeded', {
            identifier: config.config.identifier,
            key: rateLimitKey,
            limit: rateLimitResult.limit,
            current: rateLimitResult.current,
            resetIn: rateLimitResult.resetIn,
            path: request.nextUrl.pathname,
            method: request.method,
          });
        }

        // Return rate limit error response
        const errorMessage = config.errorMessage || 
          `Rate limit exceeded. Maximum ${rateLimitResult.limit} requests per ${config.config.window / 60} minutes. Please try again in ${Math.ceil(rateLimitResult.resetIn / 60)} minutes.`;

        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: errorMessage,
            limit: rateLimitResult.limit,
            resetIn: rateLimitResult.resetIn,
            retryAfter: rateLimitResult.resetIn,
          },
          {
            status: 429,
            headers: createRateLimitHeaders(rateLimitResult),
          }
        );
      }

      // Execute handler
      const response = await handler(request, context);

      // Inject rate limit headers into successful responses
      const headers = createRateLimitHeaders(rateLimitResult);
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;

    } catch (error) {
      logger.error('Rate limit middleware error', error as Error, {
        path: request.nextUrl.pathname,
        method: request.method,
        identifier: config.config.identifier,
      });
      
      // Re-throw to let global error handler deal with it
      throw error;
    }
  };
}

/**
 * Helper function to extract default rate limit key
 * 
 * @param request - Next.js request object
 * @param context - Optional context object (may contain userId, organizationId)
 * @param keyPrefix - Key prefix ('user', 'org', 'ip')
 * @returns Rate limit key
 */
async function extractDefaultKey(
  request: NextRequest,
  context: RateLimitContext | undefined,
  keyPrefix: 'user' | 'org' | 'ip'
): Promise<string> {
  switch (keyPrefix) {
    case 'user':
      // Try to extract user ID from context or headers
      if (context?.userId) {
        return context.userId;
      }
      
      // Fallback to IP if user ID not available
      return getClientIp(request);

    case 'org':
      // Try to extract organization ID from context
      if (context?.organizationId) {
        return context.organizationId;
      }
      
      // Fallback to user ID if available
      if (context?.userId) {
        return context.userId;
      }
      
      // Final fallback to IP
      return getClientIp(request);

    case 'ip':
      return getClientIp(request);

    default:
      throw new Error(`Invalid key prefix: ${keyPrefix}`);
  }
}

/**
 * Extract client IP address from request
 * 
 * @param request - Next.js request object
 * @returns Client IP address
 */
function getClientIp(request: NextRequest): string {
  // Check common headers for client IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to connection remote address (in development)
  return 'unknown-ip';
}

/**
 * Create a simple rate limit check for inline use (without wrapping handler)
 * 
 * @example
 * ```typescript
 * export const POST = async (request: NextRequest) => {
 *   const result = await checkAndEnforceRateLimit(
 *     request,
 *     RATE_LIMITS.FINANCIAL_WRITE,
 *     { userId: 'user-123' }
 *   );
 *   
 *   if (result) {
 *     return result; // Returns 429 response if rate limited
 *   }
 *   
 *   // Continue with handler logic...
 * };
 * ```
 * 
 * @param request - Next.js request object
 * @param config - Rate limit configuration
 * @param context - Optional context with userId, organizationId
 * @returns NextResponse with 429 if rate limited, or null if allowed
 */
export async function checkAndEnforceRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  context?: { userId?: string; organizationId?: string }
): Promise<NextResponse | null> {
  // Extract rate limit key (prefer userId, fallback to org, then IP)
  const rateLimitKey = context?.userId || 
                       context?.organizationId || 
                       getClientIp(request);

  // Check rate limit
  const rateLimitResult = await checkRateLimit(rateLimitKey, config);

  // If allowed, return null to continue
  if (rateLimitResult.allowed) {
    return null;
  }

  // Log violation
  logger.warn('Rate limit exceeded', {
    identifier: config.identifier,
    key: rateLimitKey,
    limit: rateLimitResult.limit,
    current: rateLimitResult.current,
    resetIn: rateLimitResult.resetIn,
    path: request.nextUrl.pathname,
    method: request.method,
  });

  // Return 429 response
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: `Rate limit exceeded. Maximum ${rateLimitResult.limit} requests per ${config.window / 60} minutes. Please try again in ${Math.ceil(rateLimitResult.resetIn / 60)} minutes.`,
      limit: rateLimitResult.limit,
      resetIn: rateLimitResult.resetIn,
      retryAfter: rateLimitResult.resetIn,
    },
    {
      status: 429,
      headers: createRateLimitHeaders(rateLimitResult),
    }
  );
}

/**
 * Check multi-layer rate limits (per-user + per-IP) for inline use
 * 
 * Provides defense-in-depth rate limiting by checking both per-user and per-IP
 * rate limits. A request must pass BOTH limits to proceed.
 * 
 * Benefits:
 * - If user account compromised, IP rate limit still protects
 * - If attacker uses multiple accounts, per-user limits still protect
 * - More robust protection against abuse and attacks
 * 
 * @example
 * ```typescript
 * import { RATE_LIMITS, RATE_LIMITS_PER_IP } from '@/lib/rate-limiter';
 * 
 * export const POST = async (request: NextRequest) => {
 *   const userId = await getCurrentUserId();
 *   
 *   const result = await checkAndEnforceMultiLayerRateLimit(
 *     request,
 *     {
 *       perUser: RATE_LIMITS.FINANCIAL_WRITE,
 *       perIP: RATE_LIMITS_PER_IP.FINANCIAL_WRITE,
 *     },
 *     { userId }
 *   );
 *   
 *   if (result) {
 *     return result; // Returns 429 response if any rate limit exceeded
 *   }
 *   
 *   // Continue with handler logic...
 * };
 * ```
 * 
 * @param request - Next.js request object
 * @param config - Multi-layer rate limit configuration
 * @param context - Optional context with userId, organizationId
 * @returns NextResponse with 429 if rate limited, or null if allowed
 */
export async function checkAndEnforceMultiLayerRateLimit(
  request: NextRequest,
  config: MultiLayerRateLimitConfig,
  context?: { userId?: string; organizationId?: string }
): Promise<NextResponse | null> {
  // Extract keys for multi-layer rate limiting
  const userId = context?.userId || context?.organizationId;
  const ipAddress = getClientIp(request);
  const endpointKey = `${request.method}:${request.nextUrl.pathname}`;

  // Check multi-layer rate limits
  const result = await checkMultiLayerRateLimit(
    {
      userId,
      ipAddress,
      endpointKey: config.perEndpoint ? endpointKey : undefined,
    },
    config
  );

  // If allowed, return null to continue
  if (result.allowed) {
    return null;
  }

  // Log violation with detailed information
  logger.warn('Multi-layer rate limit exceeded', {
    failedLayer: result.failedLayer,
    userId,
    ipAddress,
    limit: result.limit,
    remaining: result.remaining,
    resetIn: result.resetIn,
    path: request.nextUrl.pathname,
    method: request.method,
    layers: {
      user: result.layers.user ? {
        allowed: result.layers.user.allowed,
        remaining: result.layers.user.remaining,
      } : undefined,
      ip: result.layers.ip ? {
        allowed: result.layers.ip.allowed,
        remaining: result.layers.ip.remaining,
      } : undefined,
      endpoint: result.layers.endpoint ? {
        allowed: result.layers.endpoint.allowed,
        remaining: result.layers.endpoint.remaining,
      } : undefined,
    },
  });

  // Determine which limit was exceeded for error message
  const failedLayerName = result.failedLayer === 'user' 
    ? 'per-user' 
    : result.failedLayer === 'ip' 
    ? 'per-IP' 
    : 'per-endpoint';

  // Return 429 response with detailed information
  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message: `Rate limit exceeded (${failedLayerName}). Maximum ${result.limit} requests allowed. Please try again in ${Math.ceil(result.resetIn / 60)} minutes.`,
      failedLayer: result.failedLayer,
      limit: result.limit,
      remaining: result.remaining,
      resetIn: result.resetIn,
      retryAfter: result.resetIn,
    },
    {
      status: 429,
      headers: createRateLimitHeaders(result),
    }
  );
}

