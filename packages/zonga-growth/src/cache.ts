/**
 * @nzila/zonga-growth — Cache Strategy Configuration
 *
 * Defines cache keys, TTLs, and invalidation patterns for all
 * Zonga cacheable surfaces. Designed for Redis but abstracted
 * via a CachePort interface.
 *
 * @module @nzila/zonga-growth/cache
 */

// ── Cache Port ──────────────────────────────────────────────────────────────

export interface CachePort {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  /** Delete all keys matching a pattern (e.g. 'reco:org123:*'). */
  delPattern(pattern: string): Promise<number>
}

// ── Key Builders ────────────────────────────────────────────────────────────

const PREFIX = 'zonga' as const

export const CacheKeys = {
  recommendation(orgId: string, userId: string, surface: string): string {
    return `${PREFIX}:reco:${orgId}:${userId}:${surface}`
  },
  trending(orgId: string): string {
    return `${PREFIX}:trending:${orgId}`
  },
  trackMetadata(orgId: string, assetId: string): string {
    return `${PREFIX}:track:${orgId}:${assetId}`
  },
  playlistMetadata(orgId: string, playlistId: string): string {
    return `${PREFIX}:playlist:${orgId}:${playlistId}`
  },
  creatorProfile(orgId: string, creatorId: string): string {
    return `${PREFIX}:creator:${orgId}:${creatorId}`
  },
  followerCount(orgId: string, userId: string): string {
    return `${PREFIX}:followers:${orgId}:${userId}`
  },
  streamSession(sessionId: string): string {
    return `${PREFIX}:session:${sessionId}`
  },
  friendsListening(orgId: string, userId: string): string {
    return `${PREFIX}:friends:${orgId}:${userId}`
  },
} as const

// ── TTL Defaults (seconds) ──────────────────────────────────────────────────

export const CacheTTL = {
  TRACK_METADATA: 3600, // 1 hour
  PLAYLIST_METADATA: 1800, // 30 min
  CREATOR_PROFILE: 1800, // 30 min
  TRENDING: 300, // 5 min
  RECOMMENDATION_FOR_YOU: 1800, // 30 min
  RECOMMENDATION_CITY: 3600, // 1 hour
  FOLLOWER_COUNT: 600, // 10 min
  STREAM_SESSION: 86400, // 24 hours
  FRIENDS_LISTENING: 30, // 30 sec (real-time)
} as const

// ── Invalidation Patterns ───────────────────────────────────────────────────

export const InvalidationPatterns = {
  /** Invalidate all recommendations for a user. */
  userRecommendations(orgId: string, userId: string): string {
    return `${PREFIX}:reco:${orgId}:${userId}:*`
  },
  /** Invalidate all cached data for a track (metadata, recommendations referencing it). */
  track(orgId: string, assetId: string): string {
    return `${PREFIX}:track:${orgId}:${assetId}`
  },
  /** Invalidate trending cache for an org. */
  trending(orgId: string): string {
    return `${PREFIX}:trending:${orgId}`
  },
  /** Invalidate all caches for an org. */
  org(orgId: string): string {
    return `${PREFIX}:*:${orgId}:*`
  },
} as const
