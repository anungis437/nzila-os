/**
 * Redis Cache Service
 * 
 * Provides caching capabilities for:
 * - Session caching
 * - Query result caching
 * - Rate limiting
 * - Distributed locks
 * 
 * Uses Redis with ioredis client
 * 
 * Configuration via environment variables:
 * - REDIS_URL: Redis connection URL
 * - CACHE_KEY_PREFIX: Global prefix for all cache keys
 * - CACHE_DEFAULT_TTL: Default TTL in seconds (default: 300)
 * - CACHE_WARMUP_ENABLED: Enable cache warming on startup
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

// Redis client singleton
let redisClient: Redis | null = null;

// Configuration from environment
const CACHE_CONFIG = {
  keyPrefix: process.env.CACHE_KEY_PREFIX || 'unioneyes',
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'),
  warmupEnabled: process.env.CACHE_WARMUP_ENABLED === 'true',
};

/**
 * Initialize Redis connection
 */
export function initRedis(url?: string): Redis {
  if (redisClient) {
    return redisClient;
  }

  const connectionUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = new Redis(connectionUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisClient.on('error', (err) => {
    logger.error('[Redis] Connection error', err);
  });

  redisClient.on('connect', () => {
    logger.info('[Redis] Connected successfully');
  });

  redisClient.on('ready', () => {
    logger.info('[Redis] Client ready');
  });

  redisClient.on('close', () => {
    logger.warn('[Redis] Connection closed');
  });

  return redisClient;
}

/**
 * Get Redis client (lazy initialization)
 */
export function getRedis(): Redis {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[Redis] Connection closed gracefully');
  }
}

// ============== CACHE OPERATIONS ==============

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  staleWhileRevalidate?: number; // Seconds to serve stale data while revalidating
}

/**
 * Get full cache key with namespace and global prefix
 */
function getCacheKey(key: string, namespace?: string): string {
  const parts = [CACHE_CONFIG.keyPrefix];
  if (namespace) parts.push(namespace);
  parts.push(key);
  return parts.join(':');
}

/**
 * Get value from cache with stale-while-revalidate support
 */
export async function cacheGet<T>(
  key: string,
  options?: CacheOptions
): Promise<T | null> {
  const redis = getRedis();
  const cacheKey = getCacheKey(key, options?.namespace);
  
  try {
    const value = await redis.get(cacheKey);
    if (!value) return null;
    
    // Try to parse JSON, return string if not valid JSON
    try {
      const parsed = JSON.parse(value) as T;
      
      // Check if using stale-while-revalidate pattern
      if (options?.staleWhileRevalidate) {
        const ttl = await redis.ttl(cacheKey);
        
        // If TTL is less than staleWhileRevalidate window, mark as stale but return data
        if (ttl > 0 && ttl < options.staleWhileRevalidate) {
          logger.debug(`[Cache] Serving stale data for ${cacheKey}, TTL: ${ttl}s`);
        }
      }
      
      return parsed;
    } catch (error) {
      logger.debug(`[Cache] Non-JSON value for ${cacheKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return value as unknown as T;
    }
  } catch (error) {
    logger.error(`[Cache] Get error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Set value in cache
 */
export async function cacheSet(
  key: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  options?: CacheOptions
): Promise<boolean> {
  const redis = getRedis();
  const cacheKey = getCacheKey(key, options?.namespace);
  const ttl = options?.ttl || CACHE_CONFIG.defaultTTL;
  
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.setex(cacheKey, ttl, serialized);
    return true;
  } catch (error) {
    logger.error(`[Cache] Set error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function cacheDelete(
  key: string,
  options?: CacheOptions
): Promise<boolean> {
  const redis = getRedis();
  const cacheKey = getCacheKey(key, options?.namespace);
  
  try {
    await redis.del(cacheKey);
    return true;
  } catch (error) {
    logger.error(`[Cache] Delete error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Delete all keys matching a pattern
 */
export async function cacheDeletePattern(
  pattern: string,
  namespace?: string
): Promise<number> {
  const redis = getRedis();
  const fullPattern = namespace ? `${namespace}:${pattern}` : pattern;
  
  try {
    const keys = await redis.keys(fullPattern);
    if (keys.length === 0) return 0;
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    logger.error(`[Cache] Delete pattern error for ${fullPattern}`, error instanceof Error ? error : new Error(String(error)));
    return 0;
  }
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(
  key: string,
  options?: CacheOptions
): Promise<boolean> {
  const redis = getRedis();
  const cacheKey = getCacheKey(key, options?.namespace);
  
  try {
    const result = await redis.exists(cacheKey);
    return result === 1;
  } catch (error) {
    logger.error(`[Cache] Exists error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Get or set cached value (cache-aside pattern)
 */
export async function cacheGetOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key, options);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch from source
  const value = await fetchFn();
  
  // Cache the result
  await cacheSet(key, value, options);
  
  return value;
}

/**
 * Get or set with stale-while-revalidate pattern
 * Returns stale data immediately while revalidating in background
 */
export async function cacheGetOrSetStale<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions & { staleWhileRevalidate: number }
): Promise<T> {
  const redis = getRedis();
  const cacheKey = getCacheKey(key, options?.namespace);
  
  try {
    // Try to get from cache
    const cached = await cacheGet<T>(key, options);
    
    if (cached !== null) {
      // Check TTL to determine if we need to revalidate
      const ttl = await redis.ttl(cacheKey);
      
      // If within stale-while-revalidate window, trigger background refresh
      if (ttl > 0 && ttl < options!.staleWhileRevalidate) {
        logger.debug(`[Cache] Background revalidation triggered for ${cacheKey}`);
        
        // Revalidate in background (don&apos;t await)
        fetchFn()
          .then(value => cacheSet(key, value, options))
          .catch(error => {
            logger.error(`[Cache] Background revalidation failed for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
          });
      }
      
      return cached;
    }
    
    // Cache miss - fetch and cache
    const value = await fetchFn();
    await cacheSet(key, value, options);
    return value;
    
  } catch (error) {
    logger.error(`[Cache] Stale-while-revalidate error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    // Fallback to direct fetch
    return await fetchFn();
  }
}

// ============== SESSION CACHING ==============

export interface SessionCache {
  userId: string;
  organizationId: string;
  roles: string[];
  expiresAt: Date;
}

/**
 * Cache session data
 */
export async function cacheSession(
  sessionId: string,
  session: SessionCache,
  ttl = 3600 // 1 hour
): Promise<boolean> {
  return cacheSet(`session:${sessionId}`, session, { ttl, namespace: 'session' });
}

/**
 * Get cached session
 */
export async function getCachedSession(
  sessionId: string
): Promise<SessionCache | null> {
  return cacheGet<SessionCache>(sessionId, { namespace: 'session' });
}

/**
 * Invalidate session cache
 */
export async function invalidateSession(
  sessionId: string
): Promise<boolean> {
  return cacheDelete(sessionId, { namespace: 'session' });
}

// ============== RATE LIMITING ==============

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  windowSeconds: number;
}

/**
 * Check rate limit using sliding window
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  namespace = 'ratelimit'
): Promise<RateLimitResult> {
  const redis = getRedis();
  const cacheKey = `${namespace}:${key}`;
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  try {
    // Remove old entries
    await redis.zremrangebyscore(cacheKey, '-inf', windowStart);
    
    // Count current requests
    const count = await redis.zcard(cacheKey);
    
    if (count >= limit) {
      // Get the oldest entry to calculate reset time
      const oldest = await redis.zrange(cacheKey, 0, 0, 'WITHSCORES');
      const resetAt = oldest[1] ? parseInt(oldest[1]) + windowSeconds * 1000 : now + windowSeconds * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit,
        windowSeconds,
      };
    }
    
    // Add current request
    await redis.zadd(cacheKey, now, `${now}-${Math.random()}`);
    await redis.expire(cacheKey, windowSeconds);
    
    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: now + windowSeconds * 1000,
      limit,
      windowSeconds,
    };
  } catch (error) {
    logger.error(`[RateLimit] Error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    // Fail open - allow the request if Redis is unavailable
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowSeconds * 1000,
      limit,
      windowSeconds,
    };
  }
}

/**
 * Simple fixed window rate limiter (faster but less accurate)
 */
export async function checkFixedRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  namespace = 'ratelimit'
): Promise<RateLimitResult> {
  const redis = getRedis();
  const cacheKey = `${namespace}:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  
  try {
    const current = await redis.get(cacheKey);
    const count = parseInt(current || '0');
    
    if (count >= limit) {
      const windowStart = Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000;
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowStart + windowSeconds * 1000,
        limit,
        windowSeconds,
      };
    }
    
    await redis.incr(cacheKey);
    await redis.expire(cacheKey, windowSeconds);
    
    return {
      allowed: true,
      remaining: limit - count - 1,
      resetAt: Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000 + windowSeconds * 1000,
      limit,
      windowSeconds,
    };
  } catch (error) {
    logger.error(`[RateLimit] Fixed error for ${cacheKey}`, error instanceof Error ? error : new Error(String(error)));
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: Date.now() + windowSeconds * 1000,
      limit,
      windowSeconds,
    };
  }
}

// ============== DISTRIBUTED LOCKS ==============

/**
 * Acquire a distributed lock
 * Returns lock token if acquired, null otherwise
 */
export async function acquireLock(
  lockName: string,
  ttlSeconds = 30,
  namespace = 'lock'
): Promise<string | null> {
  const redis = getRedis();
  const lockKey = `${namespace}:${lockName}`;
  const token = `${Date.now()}-${Math.random()}`;
  
  try {
    // Try to set NX (only if not exists)
    const result = await redis.set(lockKey, token, 'EX', ttlSeconds, 'NX');
    return result === 'OK' ? token : null;
  } catch (error) {
    logger.error(`[Lock] Acquire error for ${lockName}`, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Release a distributed lock
 * Only releases if the token matches
 */
export async function releaseLock(
  lockName: string,
  token: string,
  namespace = 'lock'
): Promise<boolean> {
  const redis = getRedis();
  const lockKey = `${namespace}:${lockName}`;
  
  try {
    // Lua script to atomically check and delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redis.eval(script, 1, lockKey, token);
    return result === 1;
  } catch (error) {
    logger.error(`[Lock] Release error for ${lockName}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Extend lock TTL
 */
export async function extendLock(
  lockName: string,
  token: string,
  ttlSeconds: number,
  namespace = 'lock'
): Promise<boolean> {
  const redis = getRedis();
  const lockKey = `${namespace}:${lockName}`;
  
  try {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    const result = await redis.eval(script, 1, lockKey, token, ttlSeconds);
    return result === 1;
  } catch (error) {
    logger.error(`[Lock] Extend error for ${lockName}`, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  memory: string;
  keys: number;
}> {
  const redis = getRedis();
  
  try {
    const info = await redis.info('memory');
    const keyCount = await redis.dbsize();
    
    return {
      connected: true,
      memory: info,
      keys: keyCount,
    };
  } catch (_error) {
    return {
      connected: false,
      memory: 'Unknown',
      keys: 0,
    };
  }
}

/**
 * Ping Redis to check connection
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const redis = getRedis();
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// ============================================================================
// Cache Warming
// ============================================================================

export interface CacheWarmupEntry {
  key: string;
  fetchFn: () => Promise<unknown>;
  ttl?: number;
  namespace?: string;
  priority?: number; // Lower number = higher priority
}

const warmupRegistry: CacheWarmupEntry[] = [];

/**
 * Register a cache key for automatic warming
 * 
 * @example
 * ```typescript
 * registerCacheWarmup({
 *   key: 'organizations:all',
 *   fetchFn: () => db.query.organizations.findMany(),
 *   ttl: 300,
 *   namespace: 'organizations',
 *   priority: 1
 * });
 * ```
 */
export function registerCacheWarmup(entry: CacheWarmupEntry): void {
  // Check if already registered
  const existingIndex = warmupRegistry.findIndex(
    e => e.key === entry.key && e.namespace === entry.namespace
  );
  
  if (existingIndex >= 0) {
    // Update existing entry
    warmupRegistry[existingIndex] = entry;
    logger.info('[Cache] Updated warmup entry', { key: entry.key, namespace: entry.namespace });
  } else {
    // Add new entry
    warmupRegistry.push(entry);
    logger.info('[Cache] Registered warmup entry', { key: entry.key, namespace: entry.namespace });
  }
}

/**
 * Warm up a single cache entry
 */
async function warmupCacheEntry(entry: CacheWarmupEntry): Promise<void> {
  try {
    const startTime = Date.now();
    const data = await entry.fetchFn();
    
    await cacheSet(entry.key, data, {
      ttl: entry.ttl,
      namespace: entry.namespace
    });
    
    const duration = Date.now() - startTime;
    logger.info('[Cache] Warmed up entry', {
      key: entry.key,
      namespace: entry.namespace,
      durationMs: duration
    });
  } catch (error) {
    logger.error('[Cache] Failed to warm up entry', {
      key: entry.key,
      namespace: entry.namespace,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Execute cache warmup for all registered entries
 * 
 * @param options.parallel - Number of entries to warm up in parallel (default: 3)
 * @param options.priorityOnly - Only warm up entries with priority <= this value
 */
export async function executeCacheWarmup(options?: {
  parallel?: number;
  priorityOnly?: number;
}): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}> {
  const parallel = options?.parallel || 3;
  const priorityOnly = options?.priorityOnly;
  
  // Filter entries by priority if specified
  let entries = warmupRegistry;
  if (priorityOnly !== undefined) {
    entries = entries.filter(e => (e.priority || 999) <= priorityOnly);
  }
  
  // Sort by priority (lower number = higher priority)
  entries = entries.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  
  logger.info('[Cache] Starting warmup', {
    total: entries.length,
    parallel,
    priorityOnly
  });
  
  const startTime = Date.now();
  let succeeded = 0;
  let failed = 0;
  
  // Process entries in batches
  for (let i = 0; i < entries.length; i += parallel) {
    const batch = entries.slice(i, i + parallel);
    const results = await Promise.allSettled(
      batch.map(entry => warmupCacheEntry(entry))
    );
    
    succeeded += results.filter(r => r.status === 'fulfilled').length;
    failed += results.filter(r => r.status === 'rejected').length;
  }
  
  const durationMs = Date.now() - startTime;
  
  logger.info('[Cache] Warmup completed', {
    total: entries.length,
    succeeded,
    failed,
    durationMs
  });
  
  return {
    total: entries.length,
    succeeded,
    failed,
    durationMs
  };
}

/**
 * Get all registered cache warmup entries
 */
export function getCacheWarmupEntries(): Readonly<CacheWarmupEntry[]> {
  return Object.freeze([...warmupRegistry]);
}

/**
 * Clear all registered cache warmup entries
 */
export function clearCacheWarmupRegistry(): void {
  warmupRegistry.length = 0;
  logger.info('[Cache] Cleared warmup registry');
}

/**
 * Schedule periodic cache warmup
 * 
 * @param intervalMs - Interval in milliseconds (default: 5 minutes)
 * @returns Function to stop the scheduled warmup
 */
export function scheduleCacheWarmup(intervalMs: number = 5 * 60 * 1000): () => void {
  logger.info('[Cache] Scheduling periodic warmup', { intervalMs });
  
  const timerId = setInterval(async () => {
    await executeCacheWarmup({ priorityOnly: 3 }); // Only warm high-priority entries
  }, intervalMs);
  
  // Return cleanup function
  return () => {
    clearInterval(timerId);
    logger.info('[Cache] Stopped scheduled warmup');
  };
}

