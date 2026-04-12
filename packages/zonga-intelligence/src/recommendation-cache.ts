/**
 * @nzila/zonga-intelligence — Recommendation Cache
 *
 * In-memory LRU cache for recommendation results with TTL expiration,
 * tag-based invalidation, and hit/miss metrics.
 *
 * Designed to be used by the recommendation engine to avoid
 * recomputing scores for the same user/context within a short window.
 */

import type { RecommendationResult } from './types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface RecommendationCacheConfig {
  /** Maximum entries in cache */
  readonly maxEntries: number
  /** Default TTL in milliseconds */
  readonly defaultTtlMs: number
  /** TTL overrides by strategy */
  readonly strategyTtlMs: Partial<Record<string, number>>
}

export const DEFAULT_CACHE_CONFIG: Readonly<RecommendationCacheConfig> = {
  maxEntries: 10_000,
  defaultTtlMs: 5 * 60_000,         // 5 minutes
  strategyTtlMs: {
    trending: 2 * 60_000,            // 2 min — trending changes fast
    collaborative: 10 * 60_000,      // 10 min — user preferences are more stable
    content_based: 15 * 60_000,      // 15 min — content attributes rarely change
    hybrid: 5 * 60_000,              // 5 min
    editorial: 30 * 60_000,          // 30 min — manual curation
  },
}

export interface CacheEntry {
  readonly result: RecommendationResult
  readonly cachedAt: number
  readonly expiresAt: number
  readonly tags: readonly string[]
  accessedAt: number
}

export interface CacheStats {
  readonly hits: number
  readonly misses: number
  readonly evictions: number
  readonly size: number
  readonly hitRate: number
}

export interface RecommendationCache {
  readonly get: (key: string) => RecommendationResult | null
  readonly set: (key: string, result: RecommendationResult, tags?: readonly string[]) => void
  readonly invalidate: (key: string) => boolean
  readonly invalidateByTag: (tag: string) => number
  readonly invalidateForUser: (userId: string) => number
  readonly clear: () => void
  readonly stats: () => CacheStats
  readonly buildKey: (userId: string, targetType: string, strategy: string) => string
}

// ── Cache Implementation ────────────────────────────────────────────────────

/**
 * Create an LRU recommendation cache with TTL and tag-based invalidation.
 */
export function createRecommendationCache(
  config: RecommendationCacheConfig = DEFAULT_CACHE_CONFIG,
): RecommendationCache {
  const entries = new Map<string, CacheEntry>()
  const tagIndex = new Map<string, Set<string>>() // tag → set of keys
  let hits = 0
  let misses = 0
  let evictions = 0

  function evictExpired(now: number): void {
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= now) {
        removeEntry(key)
        evictions++
      }
    }
  }

  function evictLRU(): void {
    if (entries.size <= config.maxEntries) return

    // Find the least recently accessed entry
    let oldestKey: string | null = null
    let oldestAccess = Infinity

    for (const [key, entry] of entries) {
      if (entry.accessedAt < oldestAccess) {
        oldestAccess = entry.accessedAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      removeEntry(oldestKey)
      evictions++
    }
  }

  function removeEntry(key: string): void {
    const entry = entries.get(key)
    if (!entry) return

    // Remove from tag index
    for (const tag of entry.tags) {
      const keys = tagIndex.get(tag)
      if (keys) {
        keys.delete(key)
        if (keys.size === 0) tagIndex.delete(tag)
      }
    }

    entries.delete(key)
  }

  function indexTags(key: string, tags: readonly string[]): void {
    for (const tag of tags) {
      let keys = tagIndex.get(tag)
      if (!keys) {
        keys = new Set()
        tagIndex.set(tag, keys)
      }
      keys.add(key)
    }
  }

  return {
    get(key: string): RecommendationResult | null {
      const now = Date.now()
      const entry = entries.get(key)

      if (!entry) {
        misses++
        return null
      }

      if (entry.expiresAt <= now) {
        removeEntry(key)
        misses++
        evictions++
        return null
      }

      entry.accessedAt = now
      hits++
      return entry.result
    },

    set(key: string, result: RecommendationResult, tags: readonly string[] = []): void {
      const now = Date.now()

      // Periodic expired cleanup
      if (entries.size > config.maxEntries * 0.9) {
        evictExpired(now)
      }

      const ttlMs = config.strategyTtlMs[result.strategy] ?? config.defaultTtlMs
      const allTags = [...tags, `user:${result.userId}`, `strategy:${result.strategy}`]

      const entry: CacheEntry = {
        result,
        cachedAt: now,
        expiresAt: now + ttlMs,
        tags: allTags,
        accessedAt: now,
      }

      // Remove old entry if exists
      if (entries.has(key)) {
        removeEntry(key)
      }

      entries.set(key, entry)
      indexTags(key, allTags)

      // Evict LRU if over capacity
      evictLRU()
    },

    invalidate(key: string): boolean {
      if (!entries.has(key)) return false
      removeEntry(key)
      return true
    },

    invalidateByTag(tag: string): number {
      const keys = tagIndex.get(tag)
      if (!keys) return 0

      const count = keys.size
      // Copy keys to avoid mutation during iteration
      for (const key of [...keys]) {
        removeEntry(key)
      }
      return count
    },

    invalidateForUser(userId: string): number {
      return this.invalidateByTag(`user:${userId}`)
    },

    clear(): void {
      entries.clear()
      tagIndex.clear()
      hits = 0
      misses = 0
      evictions = 0
    },

    stats(): CacheStats {
      const total = hits + misses
      return {
        hits,
        misses,
        evictions,
        size: entries.size,
        hitRate: total > 0 ? Math.round((hits / total) * 10000) / 100 : 0,
      }
    },

    buildKey(userId: string, targetType: string, strategy: string): string {
      return `reco:${userId}:${targetType}:${strategy}`
    },
  }
}
