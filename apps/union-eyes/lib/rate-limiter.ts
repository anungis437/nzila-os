/**
 * Rate Limiting Utility
 * 
 * Provides Redis-based rate limiting for API endpoints to prevent abuse
 * and protect expensive operations (AI services, external APIs, etc.)
 * 
 * Features:
 * - Sliding window rate limiting
 * - Per-user and per-organization limits
 * - Configurable time windows and thresholds
 * - Graceful degradation when Redis unavailable
 */

import { Redis as UpstashRedis } from '@upstash/redis';
import IORedis from 'ioredis';
import { logger } from './logger';
import { circuitBreakers, CIRCUIT_BREAKERS, CircuitBreakerOpenError } from './circuit-breaker';

// ── Redis abstraction ────────────────────────────────────────────────────
// Wrap Upstash or ioredis behind a minimal interface so the sliding-window
// algorithm works identically against both backends.

interface RedisPipeline {
  zremrangebyscore(key: string, min: number, max: number): void;
  zcard(key: string): void;
  zadd(key: string, opts: { score: number; member: string }): void;
  expire(key: string, seconds: number): void;
  exec(): Promise<any[]>;
}

interface RedisClient {
  pipeline(): RedisPipeline;
}

function createRedisClient(): RedisClient | null {
  // Prefer Upstash (serverless/production)
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const upstash = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return upstash as any as RedisClient;
  }

  // Fallback to ioredis via REDIS_URL (local dev / Docker)
  if (process.env.REDIS_URL) {
    const io = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    io.on('error', (err) => logger.error('[rate-limiter] ioredis error', { error: err.message }));

    return {
      pipeline(): RedisPipeline {
        const p = io.pipeline();
        return {
          zremrangebyscore(key, min, max) { p.zremrangebyscore(key, min, max); },
          zcard(key) { p.zcard(key); },
          zadd(key, opts) { p.zadd(key, opts.score, opts.member); },
          expire(key, seconds) { p.expire(key, seconds); },
          async exec() {
            const results = await p.exec();
            // ioredis returns [[err, val], ...] — extract values to match Upstash shape
            return (results ?? []).map(([, val]) => val);
          },
        };
      },
    };
  }

  return null;
}

// Initialize Redis client (Upstash for serverless, ioredis for local dev)
const redis = createRedisClient();

// Initialize circuit breaker for Redis
const redisCircuitBreaker = circuitBreakers.get('redis-rate-limiter', CIRCUIT_BREAKERS.REDIS);

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  limit: number;
  /** Time window in seconds */
  window: number;
  /** Identifier for the rate limit bucket (e.g., 'ai-query', 'ml-predictions') */
  identifier: string;
  /**
   * When `true`, allow the request when the rate-limiting backend (Redis) is
   * unavailable rather than rejecting it. Use for catch-all / default limits
   * that should degrade gracefully rather than hard-block traffic on Redis
   * outages. Explicit per-route limits (AI, financial, etc.) should leave this
   * `false` (the default) so they remain enforced even under infrastructure
   * pressure.
   */
  failOpen?: boolean;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in the window */
  current: number;
  /** Maximum allowed requests */
  limit: number;
  /** Remaining requests in the window */
  remaining: number;
  /** Time in seconds until the window resets */
  resetIn: number;
  /** Optional error message when rate limiting service unavailable */
  error?: string;
}

/**
 * Check if a request should be rate limited
 * 
 * Uses sliding window algorithm with Redis for distributed rate limiting.
 * Falls back to allowing requests if Redis is unavailable (fail-open).
 * 
 * @param key - Unique identifier for the rate limit (e.g., userId, organizationId)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 * 
 * @example
 * ```typescript
 * const result = await checkRateLimit(userId, {
 *   limit: 100,
 *   window: 3600,
 *   identifier: 'ai-query'
 * });
 * 
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { 
 *       error: 'Rate limit exceeded',
 *       resetIn: result.resetIn 
 *     },
 *     { 
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': result.limit.toString(),
 *         'X-RateLimit-Remaining': result.remaining.toString(),
 *         'X-RateLimit-Reset': result.resetIn.toString(),
 *       }
 *     }
 *   );
 * }
 * ```
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { limit, window, identifier, failOpen: configFailOpen = false } = config;
  const redisKey = `ratelimit:${identifier}:${key}`;

  // If no Redis client configured at all, behaviour depends on failOpen flag.
  // Explicit limits (AI, financial) default to fail-closed to prevent abuse.
  // Catch-all / default limits set failOpen:true so Redis outages don't hard-
  // block all authenticated traffic.
  if (!redis) {
    if (configFailOpen) {
      logger.warn('Redis not configured for rate limiting - failing open (catch-all limit)', {
        key,
        identifier,
      });
      return { allowed: true, current: 0, limit, remaining: limit, resetIn: window };
    }
    logger.error('Redis not configured for rate limiting - rejecting request', {
      key,
      identifier,
      message: 'Set UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL',
    });
    return {
      allowed: false,
      current: 0,
      limit,
      remaining: 0,
      resetIn: window,
      error: 'Rate limiting service unavailable. Configure REDIS_URL or Upstash credentials.',
    };
  }

  try {
    // Use circuit breaker to protect against Redis failures
    return await redisCircuitBreaker.execute(async () => {
      const now = Date.now();
      const windowStart = now - window * 1000;

      // Use Redis transaction to atomically:
      // 1. Remove old entries outside the window
      // 2. Count current requests in the window
      // 3. Add new request timestamp
      // 4. Set expiry on the key
      const pipeline = redis.pipeline();
      
      // Remove timestamps outside the current window
      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      
      // Count requests in current window
      pipeline.zcard(redisKey);
      
      // Add current request timestamp
      pipeline.zadd(redisKey, { score: now, member: `${now}-${Math.random()}` });
      
      // Set expiry (window + 10 seconds buffer)
      pipeline.expire(redisKey, window + 10);

      const results = await pipeline.exec();
      
      // Extract count before adding current request
      const currentCount = (results[1] as number) || 0;
      const allowed = currentCount < limit;
      const remaining = Math.max(0, limit - currentCount - 1);

      return {
        allowed,
        current: currentCount + 1,
        limit,
        remaining,
        resetIn: window,
      };
    });

  } catch (error) {
    // In development, fail open when Redis is unreachable so devs are not blocked.
    // Routes that declare failOpen:true also fail open (catch-all/default limits).
    const failOpen = process.env.NODE_ENV === 'development' || configFailOpen;

    // Circuit breaker is open - service unavailable
    if (error instanceof CircuitBreakerOpenError) {
      logger.error('Rate limiting service unavailable (circuit breaker open)', {
        key,
        identifier,
        stats: error.stats,
        failOpen,
      });
      
      return {
        allowed: failOpen,
        current: 0,
        limit,
        remaining: failOpen ? limit : 0,
        resetIn: 60,
        ...(failOpen ? {} : { error: 'Rate limiting service temporarily unavailable' }),
      };
    }
    
    // Other Redis errors
    logger.error('Rate limit check failed', {
      key,
      identifier,
      error: (error as Error).message,
      errorType: (error as Error).name,
      failOpen,
    });

    return {
      allowed: failOpen,
      current: 0,
      limit,
      remaining: failOpen ? limit : 0,
      resetIn: window,
      ...(failOpen ? {} : { error: 'Rate limiting service temporarily unavailable' }),
    };
  }
}

/**
 * Predefined rate limit configurations for common use cases
 */
export const RATE_LIMITS = {
  // ===== EXPENSIVE OPERATIONS =====
  
  /**
   * AI Query endpoints (expensive Azure OpenAI calls)
   * 20 requests per hour per user
   */
  AI_QUERY: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'ai-query',
  },

  /**
   * AI Completion/Generation (very expensive OpenAI calls)
   * CRITICAL: Strict limit for cost control
   * 20 requests per hour per user
   */
  AI_COMPLETION: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'ai-completion',
  },

  /**
   * ML Training/Configuration (very expensive and resource-intensive)
   * CRITICAL: Extremely strict limit
   * 5 requests per hour per user
   */
  ML_TRAINING: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'ml-training',
  },

  /**
   * ML Predictions (expensive model inference)
   * 50 predictions per hour per user
   */
  ML_PREDICTIONS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'ml-predictions',
  },

  /**
   * Voice transcription (expensive Azure Speech API)
   * 100 transcriptions per hour per user
   */
  VOICE_TRANSCRIPTION: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'voice-transcription',
  },

  /**
   * Message sending (individual messages)
   * Moderate limit to prevent spam
   * 100 messages per hour per user
   */
  MESSAGE_SEND: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'message-send',
  },

  /**
   * Bulk message sending (broadcast messages)
   * CRITICAL: Strict limit to prevent mass spam
   * 10 bulk sends per hour per user
   */
  BULK_MESSAGE: {
    limit: 10,
    window: 3600, // 1 hour
    identifier: 'bulk-message',
  },

  /**
   * SMS sending (costs money per SMS)
   * CRITICAL: Strict limit for cost control
   * 50 SMS per hour per user
   */
  SMS_SEND: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'sms-send',
  },

  /**
   * Export generation (resource-intensive PDF/Excel generation)
   * 50 exports per hour per organization
   */
  EXPORTS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'exports',
  },

  /**
   * Webhook endpoints (prevent DDoS attacks)
   * 1000 requests per 5 minutes per IP
   */
  WEBHOOKS: {
    limit: 1000,
    window: 300, // 5 minutes
    identifier: 'webhooks',
  },

  // ===== AUTHENTICATION & SECURITY =====
  
  /**
   * Authentication endpoints (sign-in, callbacks, password reset)
   * Strict limit to prevent brute force attacks
   * 5 attempts per 15 minutes per IP
   */
  AUTH: {
    limit: 5,
    window: 900, // 15 minutes
    identifier: 'auth',
  },

  /**
   * Sign-up endpoints (account creation)
   * Prevent spam account creation
   * 3 accounts per hour per IP
   */
  SIGNUP: {
    limit: 3,
    window: 3600, // 1 hour
    identifier: 'signup',
  },

  /**
   * Password reset requests
   * Prevent email bombing attacks
   * 3 requests per hour per IP
   */
  PASSWORD_RESET: {
    limit: 3,
    window: 3600, // 1 hour
    identifier: 'password-reset',
  },

  // ===== BUSINESS OPERATIONS =====
  
  /**
   * Claims submission (POST /api/claims)
   * Moderate limit to allow legitimate bulk submissions
   * 20 claims per minute per user
   */
  CLAIMS_CREATE: {
    limit: 20,
    window: 60, // 1 minute
    identifier: 'claims-create',
  },

  /**
   * Claims read operations (GET /api/claims)
   * Higher limit for read operations
   * 100 requests per minute per user
   */
  CLAIMS_READ: {
    limit: 100,
    window: 60, // 1 minute
    identifier: 'claims-read',
  },

  /**
   * Claims update/delete operations
   * Lower limit for write operations
   * 30 updates per minute per user
   */
  CLAIMS_WRITE: {
    limit: 30,
    window: 60, // 1 minute
    identifier: 'claims-write',
  },

  /**
   * Voting session creation (POST /api/voting/sessions)
   * Strict limit - voting sessions are sensitive
   * 5 sessions per hour per organization
   */
  VOTING_CREATE: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'voting-create',
  },

  /**
   * Vote casting (POST /api/voting/sessions/:id/vote)
   * Moderate limit per user
   * 10 votes per minute per user
   */
  VOTING_CAST: {
    limit: 10,
    window: 60, // 1 minute
    identifier: 'voting-cast',
  },

  /**
   * Voting results (GET /api/voting/sessions/:id/results)
   * Higher limit for read operations
   * 60 requests per minute per user
   */
  VOTING_READ: {
    limit: 60,
    window: 60, // 1 minute
    identifier: 'voting-read',
  },

  /**
   * Organization creation (POST /api/organizations)
   * Very strict - organizations are sensitive
   * 2 per hour per user
   */
  ORG_CREATE: {
    limit: 2,
    window: 3600, // 1 hour
    identifier: 'org-create',
  },

  /**
   * Organization read operations (GET /api/organizations)
   * Higher limit for read operations
   * 100 requests per minute per user
   */
  ORG_READ: {
    limit: 100,
    window: 60, // 1 minute
    identifier: 'org-read',
  },

  /**
   * Organization update operations (PATCH /api/organizations/:id)
   * Moderate limit for updates
   * 20 updates per hour per user
   */
  ORG_WRITE: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'org-write',
  },

  /**
   * Organization operations (hierarchy, members, etc.)
   * Phase 3 Data Management
   * 50 requests per hour per organization
   */
  ORGANIZATION_OPERATIONS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'organization-operations',
  },

  /**
   * Equity analytics and reporting
   * Phase 3 Data Management - sensitive demographic data
   * 30 requests per hour per organization
   */
  EQUITY_ANALYTICS: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'equity-analytics',
  },

  /**
   * Onboarding operations (federation discovery, clause suggestions, benchmarks)
   * Moderate limit to prevent abuse while allowing legitimate onboarding workflow
   * 30 requests per hour per user
   */
  ONBOARDING: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'onboarding',
  },

  /**
   * Member operations (profile updates, role changes)
   * Moderate limit
   * 50 operations per hour per user
   */
  MEMBERS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'members',
  },

  /**
   * Member bulk import operations (POST /api/members/bulk)
   * Strict limit for bulk operations
   * 5 requests per hour per user
   */
  MEMBER_BULK_IMPORT: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'member-bulk-import',
  },

  /**
   * Member export operations (GET /api/members/export)
   * Moderate limit for export operations
   * 20 requests per hour per user
   */
  MEMBER_EXPORT: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'member-export',
  },

  /**
   * Claims operations (approve, reject, status updates)
   * Moderate limit for claims operations
   * 50 requests per hour per user
   */
  CLAIMS_OPERATIONS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'claims-operations',
  },

  // ===== FINANCIAL OPERATIONS =====
  
  /**
   * Dues payment processing (POST /api/portal/dues/pay)
   * Strict limit to prevent financial abuse
   * 10 payments per hour per user
   */
  DUES_PAYMENT: {
    limit: 10,
    window: 3600, // 1 hour
    identifier: 'dues-payment',
  },

  /**
   * Strike fund operations (GET/POST /api/strike/funds)
   * Moderate limit for financial operations
   * 15 operations per hour per user
   */
  STRIKE_FUND: {
    limit: 15,
    window: 3600, // 1 hour
    identifier: 'strike-fund',
  },

  /**
   * Strike stipend requests (POST /api/strike/stipends)
   * Strict limit for financial requests
   * 5 requests per hour per user
   */
  STRIKE_STIPEND: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'strike-stipend',
  },

  /**
   * Financial write operations (dues, payments, etc.)
   * Strict limit for financial write operations
   * 20 requests per hour per user
   */
  FINANCIAL_WRITE: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'financial-write',
  },

  /**
   * Financial read operations (balance, history, etc.)
   * Higher limit for read operations
   * 100 requests per hour per user
   */
  FINANCIAL_READ: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'financial-read',
  },

  /**
   * Tax slip generation (GET /api/tax/slips, POST /api/tax/t4a)
   * Strict limit for tax operations
   * 10 requests per hour per user
   */
  TAX_OPERATIONS: {
    limit: 10,
    window: 3600, // 1 hour
    identifier: 'tax-operations',
  },

  /**
   * Reconciliation operations (upload, process, resolve)
   * Moderate limit for reconciliation operations
   * 10 requests per hour per user
   */
  RECONCILIATION: {
    limit: 10,
    window: 3600, // 1 hour
    identifier: 'reconciliation',
  },

  /**
   * CLC operations (remittances, analytics, etc.)
   * Moderate limit for CLC operations
   * 50 requests per hour per user
   */
  CLC_OPERATIONS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'clc-operations',
  },

  /**
   * Pension operations (GET/POST /api/pension/*)
   * Moderate limit for pension operations
   * 30 operations per hour per user
   */
  PENSION_OPERATIONS: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'pension-operations',
  },

  // ===== GENERAL API =====
  
  /**
   * General API rate limit (default for unspecified endpoints)
   * Generous limit for general operations
   * 1000 requests per hour per user
   */
  GENERAL_API: {
    limit: 1000,
    window: 3600, // 1 hour
    identifier: 'general-api',
  },

  /**
   * Upload endpoints (file uploads)
   * Moderate limit to prevent storage abuse
   * 50 uploads per hour per user
   */
  UPLOADS: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'uploads',
  },

  // ===== DOCUMENT OPERATIONS =====
  
  /**
   * Document uploads (POST /api/documents/upload)
   * Moderate limit to prevent storage abuse
   * 30 uploads per hour per user
   */
  DOCUMENT_UPLOAD: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'document-upload',
  },

  /**
   * Document downloads (GET /api/documents/[id]/download)
   * Higher limit for document downloads
   * 100 downloads per hour per user
   */
  DOCUMENT_DOWNLOAD: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'document-download',
  },

  /**
   * Storage operations (GET/POST /api/storage/*)
   * Strict limit for storage management
   * 20 operations per hour per user
   */
  STORAGE_OPERATIONS: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'storage-operations',
  },

  // ===== PHASE 4: CALENDAR, EVENTS, AND SYSTEM UTILITIES =====

  /**
   * Calendar operations (GET/POST/PATCH/DELETE /api/calendar/**)
   * Moderate limit for calendar management
   * 60 requests per hour per user
   */
  CALENDAR_OPERATIONS: {
    limit: 60,
    window: 3600, // 1 hour
    identifier: 'calendar-operations',
  },

  /**
   * Event operations (GET/POST/PATCH/DELETE /api/events/**)
   * Moderate limit for event management
   * 60 requests per hour per user
   */
  EVENT_OPERATIONS: {
    limit: 60,
    window: 3600, // 1 hour
    identifier: 'event-operations',
  },

  /**
   * Webhook calls (POST /api/webhooks/*)
   * High limit for external system integrations
   * 300 requests per hour per IP/source
   */
  WEBHOOK_CALLS: {
    limit: 300,
    window: 3600, // 1 hour
    identifier: 'webhook-calls',
  },

  /**
   * System operations (POST /api/admin/system/*)
   * Strict limit for admin system utilities
   * 30 requests per hour per admin
   */
  SYSTEM_OPERATIONS: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'system-operations',
  },

  // ===== PHASE 4: ANALYTICS & REPORTING =====

  /**
   * Analytics query operations (GET /api/analytics/**)
   * Moderate limit for complex analytics queries
   * 60 requests per hour per user
   */
  ANALYTICS_QUERY: {
    limit: 60,
    window: 3600, // 1 hour
    identifier: 'analytics-query',
  },

  /**
   * Analytics export operations (POST /api/analytics/export, /api/reports/export)
   * Strict limit for resource-intensive CSV/PDF exports
   * 10 requests per hour per user
   */
  ANALYTICS_EXPORT: {
    limit: 10,
    window: 3600, // 1 hour
    identifier: 'analytics-export',
  },

  /**
   * Dashboard refresh operations (GET /api/dashboard/**)
   * Higher limit for real-time dashboard updates
   * 120 requests per hour per user
   */
  DASHBOARD_REFRESH: {
    limit: 120,
    window: 3600, // 1 hour
    identifier: 'dashboard-refresh',
  },

  /**
   * Report execution operations (POST /api/reports/execute, /api/reports/[id]/execute)
   * Moderate limit for report generation
   * 30 requests per hour per user
   */
  REPORT_EXECUTION: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'report-execution',
  },

  /**
   * Report builder operations (POST /api/reports/builder)
   * Moderate limit for report configuration
   * 20 requests per hour per user
   */
  REPORT_BUILDER: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'report-builder',
  },

  /**
   * Advanced analytics operations (POST /api/analytics/predictions, /api/analytics/insights)
   * Strict limit for AI-driven analytics
   * 20 requests per hour per user
   */
  ADVANCED_ANALYTICS: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'advanced-analytics',
  },

  // ===== PHASE 4: SOCIAL MEDIA & CAMPAIGNS =====
  
  /**
   * Campaign operations (create, edit, schedule)
   * Moderate limit to prevent spam/abuse
   * 30 requests per hour per user
   */
  CAMPAIGN_OPERATIONS: {
    limit: 30,
    window: 3600, // 1 hour
    identifier: 'campaign-operations',
  },

  /**
   * Social media post operations (publish, schedule)
   * Strict limit to prevent spam/abuse of posting features
   * 20 requests per hour per user
   */
  SOCIAL_MEDIA_POST: {
    limit: 20,
    window: 3600, // 1 hour
    identifier: 'social-media-post',
  },

  /**
   * Social media API calls (external platform API calls)
   * Higher limit for API calls to external platforms
   * 100 requests per hour per organization
   */
  SOCIAL_MEDIA_API: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'social-media-api',
  },

  // ===== CATCH-ALL / DEFAULT LIMITS =====

  /**
   * Default org-level safety net applied automatically to all `withApi` routes
   * that do not declare an explicit `rateLimit` option.
   *
   * Keyed by organizationId — gives each org a shared bucket across all its
   * users. This prevents a single compromised or runaway client within an org
   * from flooding the API while staying well clear of legitimate usage patterns.
   *
   * failOpen: true — degrades gracefully when Redis is unavailable rather than
   * hard-blocking all authenticated traffic. Explicit per-route limits remain
   * fail-closed regardless of this setting.
   *
   * 1 200 requests per 5 minutes per organization (~240 req/min).
   */
  DEFAULT_API_ORG: {
    limit: 1200,
    window: 300, // 5 minutes
    identifier: 'default-api-org',
    failOpen: true,
  },

  /**
   * IP-based rate limit for authentication endpoints (/api/auth/**).
   *
   * Applied at the edge (proxy.ts) using the client IP as the key.
   * Protects against brute-force credential attacks even before a session
   * is established (no org header available at this point).
   *
   * 600 requests per 15 minutes per IP address.
   * This keeps brute-force protection on mutating auth endpoints while
   * tolerating noisy session polling from tabs and auth providers.
   *
   * failOpen: false — brute-force protection must be enforced even on Redis
   * outages. The proxy falls back gracefully (logs + passes request) when
   * the check itself throws, but a clean Redis-unavailable response returns
   * 429 for safety.
   */
  AUTH_IP: {
    limit: 600,
    window: 900, // 15 minutes
    identifier: 'auth-ip-v2',
    failOpen: false,
  },

  /**
   * IP-based rate limit for auth status/session read endpoints.
   *
   * Applied to low-risk GET endpoints like /api/auth/me and
   * /api/auth/methods that may be called repeatedly by multiple mounted
   * components or tabs during normal app usage.
   *
   * 120 requests per 15 minutes per IP address.
   * Keeps abuse protection in place while preventing noisy false positives
   * for authenticated demo and production browsing patterns.
   */
  AUTH_STATUS_IP: {
    limit: 120,
    window: 900, // 15 minutes
    identifier: 'auth-status-ip',
    failOpen: false,
  },
} as const;

/**
 * Multi-layer rate limit configuration
 * 
 * Enables defense-in-depth rate limiting where a request must pass
 * multiple rate limit checks (per-user, per-IP, per-endpoint).
 */
export interface MultiLayerRateLimitConfig {
  /** Per-user rate limit (based on userId) */
  perUser?: RateLimitConfig;
  
  /** Per-IP rate limit (based on client IP address) */
  perIP?: RateLimitConfig;
  
  /** Per-endpoint/operation rate limit (global for all users) */
  perEndpoint?: RateLimitConfig;
}

/**
 * Multi-layer rate limit result with detailed failure information
 */
export interface MultiLayerRateLimitResult {
  /** Whether all rate limits were satisfied */
  allowed: boolean;
  
  /** Which layer failed (if any): 'user', 'ip', 'endpoint', or null */
  failedLayer: 'user' | 'ip' | 'endpoint' | null;
  
  /** Individual rate limit results for each layer */
  layers: {
    user?: RateLimitResult;
    ip?: RateLimitResult;
    endpoint?: RateLimitResult;
  };
  
  /** Most restrictive limit that applies */
  limit: number;
  
  /** Most restrictive remaining count */
  remaining: number;
  
  /** Shortest reset time (when the next request might succeed) */
  resetIn: number;
}

/**
 * Check multi-layer rate limits (per-user, per-IP, per-endpoint)
 * 
 * Provides defense-in-depth rate limiting by checking multiple rate limit
 * layers. A request must pass ALL configured rate limits to proceed.
 * 
 * Benefits:
 * - If user account compromised, IP rate limit still protects
 * - If attacker uses multiple accounts, per-user limits still protect
 * - If distributed attack uses multiple IPs, per-endpoint limits protect
 * 
 * @param keys - Object containing userId, ipAddress, endpointKey
 * @param config - Multi-layer rate limit configuration
 * @returns Multi-layer rate limit result
 * 
 * @example
 * ```typescript
 * const result = await checkMultiLayerRateLimit(
 *   {
 *     userId: 'user-123',
 *     ipAddress: '192.168.1.1',
 *     endpointKey: 'financial-write'
 *   },
 *   {
 *     perUser: RATE_LIMITS.FINANCIAL_WRITE,
 *     perIP: RATE_LIMITS_PER_IP.FINANCIAL_WRITE,
 *     perEndpoint: RATE_LIMITS_PER_ENDPOINT.FINANCIAL_WRITE
 *   }
 * );
 * 
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { 
 *       error: 'Rate limit exceeded',
 *       failedLayer: result.failedLayer,
 *       resetIn: result.resetIn 
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export async function checkMultiLayerRateLimit(
  keys: {
    userId?: string;
    ipAddress?: string;
    endpointKey?: string;
  },
  config: MultiLayerRateLimitConfig
): Promise<MultiLayerRateLimitResult> {
  const layers: MultiLayerRateLimitResult['layers'] = {};
  let allowed = true;
  let failedLayer: MultiLayerRateLimitResult['failedLayer'] = null;
  let mostRestrictiveLimit = Infinity;
  let mostRestrictiveRemaining = Infinity;
  let shortestResetIn = 0;

  // Check per-user rate limit
  if (config.perUser && keys.userId) {
    const userResult = await checkRateLimit(keys.userId, config.perUser);
    layers.user = userResult;
    
    if (!userResult.allowed) {
      allowed = false;
      failedLayer = 'user';
    }
    
    // Update most restrictive values
    if (userResult.remaining < mostRestrictiveRemaining) {
      mostRestrictiveRemaining = userResult.remaining;
      mostRestrictiveLimit = userResult.limit;
    }
    if (userResult.resetIn > shortestResetIn) {
      shortestResetIn = userResult.resetIn;
    }
  }

  // Check per-IP rate limit (always check, even if user limit failed - for metrics)
  if (config.perIP && keys.ipAddress) {
    const ipResult = await checkRateLimit(keys.ipAddress, config.perIP);
    layers.ip = ipResult;
    
    if (!ipResult.allowed && allowed) {
      // Only set as failed layer if user limit didn't already fail
      allowed = false;
      failedLayer = 'ip';
    }
    
    // Update most restrictive values
    if (ipResult.remaining < mostRestrictiveRemaining) {
      mostRestrictiveRemaining = ipResult.remaining;
      mostRestrictiveLimit = ipResult.limit;
    }
    if (ipResult.resetIn > shortestResetIn) {
      shortestResetIn = ipResult.resetIn;
    }
  }

  // Check per-endpoint rate limit (global limit)
  if (config.perEndpoint && keys.endpointKey) {
    const endpointResult = await checkRateLimit(
      keys.endpointKey,
      config.perEndpoint
    );
    layers.endpoint = endpointResult;
    
    if (!endpointResult.allowed && allowed) {
      // Only set as failed layer if user/IP limits didn't already fail
      allowed = false;
      failedLayer = 'endpoint';
    }
    
    // Update most restrictive values
    if (endpointResult.remaining < mostRestrictiveRemaining) {
      mostRestrictiveRemaining = endpointResult.remaining;
      mostRestrictiveLimit = endpointResult.limit;
    }
    if (endpointResult.resetIn > shortestResetIn) {
      shortestResetIn = endpointResult.resetIn;
    }
  }

  return {
    allowed,
    failedLayer,
    layers,
    limit: mostRestrictiveLimit === Infinity ? 0 : mostRestrictiveLimit,
    remaining: mostRestrictiveRemaining === Infinity ? 0 : mostRestrictiveRemaining,
    resetIn: shortestResetIn,
  };
}

/**
 * Predefined per-IP rate limit configurations
 * 
 * More restrictive than per-user limits to prevent distributed attacks
 * using multiple accounts from the same IP.
 */
export const RATE_LIMITS_PER_IP = {
  /**
   * Authentication endpoints per IP
   * Stricter than per-user to prevent credential stuffing
   * 10 attempts per 15 minutes per IP
   */
  AUTH: {
    limit: 10,
    window: 900, // 15 minutes
    identifier: 'auth-per-ip',
  },

  /**
   * Sign-up endpoints per IP
   * Prevent mass account creation from single IP
   * 5 accounts per hour per IP
   */
  SIGNUP: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'signup-per-ip',
  },

  /**
   * Password reset per IP
   * Prevent email bombing from single IP
   * 5 requests per hour per IP
   */
  PASSWORD_RESET: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'password-reset-per-ip',
  },

  /**
   * Financial write operations per IP
   * Prevent payment fraud from single IP with multiple accounts
   * 50 requests per hour per IP
   */
  FINANCIAL_WRITE: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'financial-write-per-ip',
  },

  /**
   * AI query endpoints per IP
   * Prevent cost abuse from single IP with multiple accounts
   * 50 requests per hour per IP
   */
  AI_QUERY: {
    limit: 50,
    window: 3600, // 1 hour
    identifier: 'ai-query-per-ip',
  },

  /**
   * Document uploads per IP
   * Prevent storage abuse from single IP
   * 100 uploads per hour per IP
   */
  DOCUMENT_UPLOAD: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'document-upload-per-ip',
  },

  /**
   * Exports per IP
   * Prevent resource exhaustion from single IP
   * 100 exports per hour per IP
   */
  EXPORTS: {
    limit: 100,
    window: 3600, // 1 hour
    identifier: 'exports-per-ip',
  },

  /**
   * General API requests per IP
   * Broad protection against API abuse
   * 2000 requests per hour per IP (2x per-user general limit)
   */
  GENERAL_API: {
    limit: 2000,
    window: 3600, // 1 hour
    identifier: 'general-api-per-ip',
  },

  /**
   * Pilot program public lead-intake form per IP (PR #752 round 20)
   * Unauthenticated by design — prospective unions apply before any
   * account/org exists. Fail-closed (no failOpen) since this endpoint has
   * no other abuse control.
   * 5 applications per hour per IP
   */
  PILOT_APPLY: {
    limit: 5,
    window: 3600, // 1 hour
    identifier: 'pilot-apply-per-ip',
  },
} as const;

/**
 * Helper to create rate limit response headers
 * 
 * @param result - Rate limit result or multi-layer result
 * @returns Headers object for Next.js Response
 */
export function createRateLimitHeaders(
  result: RateLimitResult | MultiLayerRateLimitResult
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
    'Retry-After': result.resetIn.toString(),
  };

  // Add failed layer information for multi-layer results
  if ('failedLayer' in result && result.failedLayer) {
    headers['X-RateLimit-Failed-Layer'] = result.failedLayer;
  }

  return headers;
}

