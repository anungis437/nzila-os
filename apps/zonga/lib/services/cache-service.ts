/**
 * Cache service — Zonga.
 *
 * Pluggable Redis-backed cache with an in-memory fallback so the app
 * stays functional in environments where Redis is not provisioned
 * (current staging posture as of 2026-04). Mirrors the surface of
 * `apps/union-eyes/lib/services/cache-service.ts` for the operations
 * we use today (`cacheGet`, `cacheSet`).
 */
import { logger } from '@/lib/logger'

export interface CacheOptions {
  ttl?: number
  namespace?: string
}

interface RedisLike {
  get(key: string): Promise<string | null>
  setex(key: string, ttl: number, value: string): Promise<unknown>
  quit(): Promise<unknown>
  on(event: string, handler: (err: unknown) => void): unknown
}

const KEY_PREFIX = process.env.CACHE_KEY_PREFIX ?? 'zonga'
const DEFAULT_TTL = Number(process.env.CACHE_DEFAULT_TTL ?? '120')

let redisClient: RedisLike | null = null
let redisInitAttempted = false

interface MemoryEntry {
  value: string
  expiresAt: number
}
// ga-check:exempt explicit fallback cache with TTL; Redis remains the primary cache backend
const memoryStore = new Map<string, MemoryEntry>()

function buildKey(key: string, namespace?: string): string {
  return [KEY_PREFIX, namespace, key].filter(Boolean).join(':')
}

async function getRedis(): Promise<RedisLike | null> {
  if (redisClient) return redisClient
  if (redisInitAttempted) return null
  redisInitAttempted = true

  const url = process.env.REDIS_URL
  if (!url) return null

  try {
    const mod = (await import('ioredis')) as unknown as {
      default: new (url: string, opts?: Record<string, unknown>) => RedisLike
    }
    const client = new mod.default(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    })
    client.on('error', (err) => {
      logger.warn('[zonga-cache] redis error', { err })
    })
    redisClient = client
    return client
  } catch (err) {
    logger.warn('[zonga-cache] ioredis unavailable, using in-memory fallback', { err })
    return null
  }
}

export async function cacheGet<T>(key: string, options?: CacheOptions): Promise<T | null> {
  const fullKey = buildKey(key, options?.namespace)
  const redis = await getRedis()
  let raw: string | null = null

  if (redis) {
    try {
      raw = await redis.get(fullKey)
    } catch (err) {
      logger.warn('[zonga-cache] redis get failed, falling back to memory', { err, fullKey })
    }
  }

  if (raw === null) {
    const entry = memoryStore.get(fullKey)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      memoryStore.delete(fullKey)
      return null
    }
    raw = entry.value
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return raw as unknown as T
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  options?: CacheOptions,
): Promise<boolean> {
  const fullKey = buildKey(key, options?.namespace)
  const ttl = options?.ttl ?? DEFAULT_TTL
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)

  const redis = await getRedis()
  if (redis) {
    try {
      await redis.setex(fullKey, ttl, serialized)
      return true
    } catch (err) {
      logger.warn('[zonga-cache] redis set failed, falling back to memory', { err, fullKey })
    }
  }

  memoryStore.set(fullKey, {
    value: serialized,
    expiresAt: Date.now() + ttl * 1000,
  })
  return true
}

/** Test-only: clear in-memory cache. */
export function _resetMemoryCache(): void {
  memoryStore.clear()
}
