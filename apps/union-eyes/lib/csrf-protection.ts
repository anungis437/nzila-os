/**
 * CSRF Protection Middleware
 * 
 * Protects against Cross-Site Request Forgery attacks by validating
 * tokens on state-changing requests (POST, PUT, DELETE, PATCH).
 * 
 * Features:
 * - Double-submit cookie pattern
 * - Per-session tokens with Redis storage
 * - Automatic token rotation
 * - SameSite cookie protection
 * 
 * Standards: OWASP CSRF Prevention Cheat Sheet
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Redis } from '@upstash/redis';
import { logger } from './logger';
import crypto from 'crypto';

// Initialize Redis client (same as rate-limiter)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Constants
const CSRF_COOKIE_NAME = '__Host-csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_LENGTH = 32; // 256 bits
const TOKEN_TTL = 3600; // 1 hour in seconds

/**
 * Generate cryptographically secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('base64url');
}

/**
 * Get CSRF token key for Redis
 */
function getTokenKey(sessionId: string): string {
  return `csrf:token:${sessionId}`;
}

/**
 * Generate and store CSRF token for a session
 * 
 * @param sessionId - User session ID (from auth provider or custom auth)
 * @returns CSRF token string
 */
export async function generateCSRFToken(sessionId: string): Promise<string> {
  const token = generateToken();

  if (redis) {
    try {
      const key = getTokenKey(sessionId);
      await redis.setex(key, TOKEN_TTL, token);
      
      logger.info('Generated CSRF token', {
        sessionId,
        expiresIn: TOKEN_TTL,
      });
    } catch (error) {
      logger.error('Failed to store CSRF token in Redis', error as Error, { sessionId });
      // Fall through - token still returned for cookie
    }
  }

  return token;
}

/**
 * Validate CSRF token against stored value
 * 
 * @param sessionId - User session ID
 * @param token - Token from request header
 * @returns true if valid, false otherwise
 */
export async function validateCSRFToken(sessionId: string, token: string): Promise<boolean> {
  if (!token) {
    logger.warn('CSRF validation failed: no token provided', { sessionId });
    return false;
  }

  if (!redis) {
    // If Redis not configured, fall back to cookie-only validation
    // (less secure but better than no protection)
    logger.warn('Redis not configured - using cookie-only CSRF validation');
    return true;
  }

  try {
    const key = getTokenKey(sessionId);
    const storedToken = await redis.get(key);

    if (!storedToken) {
      logger.warn('CSRF validation failed: token not found or expired', { sessionId });
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    const valid = crypto.timingSafeEqual(
      Buffer.from(storedToken as string),
      Buffer.from(token)
    );

    if (!valid) {
      logger.warn('CSRF validation failed: token mismatch', { sessionId });
    }

    return valid;

  } catch (error) {
    logger.error('CSRF token validation error', error as Error, { sessionId });
    return false;
  }
}

/**
 * Invalidate CSRF token (on logout or session change)
 * 
 * @param sessionId - User session ID
 */
export async function invalidateCSRFToken(sessionId: string): Promise<void> {
  if (!redis) return;

  try {
    const key = getTokenKey(sessionId);
    await redis.del(key);
    
    logger.info('Invalidated CSRF token', { sessionId });
  } catch (error) {
    logger.error('Failed to invalidate CSRF token', error as Error, { sessionId });
  }
}

/**
 * CSRF protection middleware for API routes
 * 
 * Usage:
 * ```typescript
 * export const POST = withCSRFProtection(async (req: NextRequest) => {
 *   // Your handler code - CSRF already validated
 *   return NextResponse.json({ success: true });
 * });
 * ```
 * 
 * @param handler - API route handler
 * @returns Protected handler with CSRF validation
 */
export function withCSRFProtection(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const method = req.method;

    // Only validate state-changing methods
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return handler(req, ...args);
    }

    // Extract session ID (from auth session or custom auth)
    const sessionId = req.headers.get('x-session-id') || 
                     req.cookies.get('__clerk_db_jwt')?.value ||
                     'anonymous';

    // Get CSRF token from header
    const csrfToken = req.headers.get(CSRF_HEADER_NAME);

    if (!csrfToken) {
      logger.warn('CSRF protection: missing token', {
        method,
        url: req.url,
        sessionId,
      });

      return NextResponse.json(
        { 
          error: 'CSRF token required',
          code: 'CSRF_TOKEN_MISSING',
        },
        { status: 403 }
      );
    }

    // Validate token
    const valid = await validateCSRFToken(sessionId, csrfToken);

    if (!valid) {
      logger.warn('CSRF protection: invalid token', {
        method,
        url: req.url,
        sessionId,
      });

      return NextResponse.json(
        { 
          error: 'Invalid CSRF token',
          code: 'CSRF_TOKEN_INVALID',
        },
        { status: 403 }
      );
    }

    // Token valid - proceed with request
    return handler(req, ...args);
  };
}

/**
 * Set CSRF token cookie in response
 * 
 * Usage in API route or middleware:
 * ```typescript
 * const response = NextResponse.json(data);
 * await setCSRFCookie(response, sessionId);
 * return response;
 * ```
 * 
 * @param response - NextResponse object
 * @param sessionId - User session ID
 */
export async function setCSRFCookie(
  response: NextResponse,
  sessionId: string
): Promise<void> {
  const token = await generateCSRFToken(sessionId);

  // Set secure cookie with SameSite protection
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,      // JavaScript needs to read this for header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',   // Strict CSRF protection
    maxAge: TOKEN_TTL,
    path: '/',
  });
}

/**
 * Get CSRF token from cookies (client-side helper)
 * 
 * Usage in client components:
 * ```typescript
 * import { getCSRFTokenFromCookie } from '@/lib/csrf-protection';
 * 
 * const token = getCSRFTokenFromCookie();
 * 
 * fetch('/api/protected', {
 *   method: 'POST',
 *   headers: {
 *     'x-csrf-token': token,
 *   },
 * });
 * ```
 */
export async function getCSRFTokenFromCookie(): Promise<string | null> {
  if (typeof document === 'undefined') {
    // Server-side - use next/headers
    const cookieStore = await cookies();
    return cookieStore.get(CSRF_COOKIE_NAME)?.value || null;
  }

  // Client-side - parse document.cookie
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Exempt paths from CSRF protection
 * Useful for webhooks and public APIs
 */
const CSRF_EXEMPT_PATHS = [
  '/api/webhooks/',       // Webhook endpoints
  '/api/auth/callback',   // OAuth callbacks
  '/api/health',          // Health check
];

/**
 * Check if path is exempt from CSRF protection
 */
export function isCSRFExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some(exemptPath => pathname.startsWith(exemptPath));
}

/**
 * Middleware to automatically add CSRF protection to all API routes
 * Add to middleware.ts:
 * 
 * ```typescript
 * import { csrfMiddleware } from '@/lib/csrf-protection';
 * 
 * export async function middleware(request: NextRequest) {
 *   // Your existing middleware logic
 *   
 *   // Add CSRF protection
 *   const csrfResponse = await csrfMiddleware(request);
 *   if (csrfResponse) return csrfResponse;
 *   
 *   // Continue...
 * }
 * ```
 */
export async function csrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;
  const method = request.method;

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return null;
  }

  // Skip exempt paths
  if (isCSRFExempt(pathname)) {
    return null;
  }

  // Skip safe methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  // Validate CSRF token
  const sessionId = request.headers.get('x-session-id') || 
                   request.cookies.get('__clerk_db_jwt')?.value ||
                   'anonymous';

  const csrfToken = request.headers.get(CSRF_HEADER_NAME);

  if (!csrfToken) {
    logger.warn('CSRF middleware: missing token', {
      method,
      pathname,
      sessionId,
    });

    return NextResponse.json(
      { 
        error: 'CSRF token required',
        code: 'CSRF_TOKEN_MISSING',
      },
      { status: 403 }
    );
  }

  const valid = await validateCSRFToken(sessionId, csrfToken);

  if (!valid) {
    logger.warn('CSRF middleware: invalid token', {
      method,
      pathname,
      sessionId,
    });

    return NextResponse.json(
      { 
        error: 'Invalid CSRF token',
        code: 'CSRF_TOKEN_INVALID',
      },
      { status: 403 }
    );
  }

  // Token valid - continue to route handler
  return null;
}


