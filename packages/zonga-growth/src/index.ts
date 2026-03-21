/**
 * @nzila/zonga-growth — Growth Engine
 *
 * Social graph, recommendations, discovery, creator dashboard,
 * and viral sharing loops.
 */

// ── Social Graph ────────────────────────────────────────────────────────────
export {
  EntityType,
  createSocialGraphService,
  validateFollow,
  safePagination,
  type FollowRelation,
  type UserActivity,
  type FollowStats,
  type ActivityFeedItem,
  type SocialRepository,
} from './social'

// ── Recommendations ─────────────────────────────────────────────────────────
export {
  CACHE_TTL,
  computeTrendingScores,
  createRecommendationService,
  type RecommendationSurface,
  type CachedRecommendation,
  type TrendingSignal,
  type TrendingScore,
  type RecommendationCacheStore,
  type TrendingDataPort,
} from './recommendations'

// ── Discovery ───────────────────────────────────────────────────────────────
export {
  createDiscoveryService,
  toDiscoveryItems,
  trendingToDiscoveryItems,
  type DiscoverySection,
  type DiscoveryItem,
  type DiscoveryFeed,
  type DiscoveryQuery,
  type RecommendationPort,
} from './discovery'

// ── Creator Dashboard ───────────────────────────────────────────────────────
export {
  createCreatorDashboardService,
  computeRevenueBreakdown,
  computePerStreamRevenue,
  rankTracksByRevenue,
  identifyHighSkipTracks,
  validateDashboardPeriod,
  type CreatorOverview,
  type TrackPerformance,
  type AudienceGeo,
  type RevenueBreakdown,
  type DashboardPeriod,
  type EarningsTimeSeries,
  type CreatorAnalyticsRepository,
} from './creator-dashboard'

// ── Sharing & Viral Loops ───────────────────────────────────────────────────
export {
  ShareType,
  SharePlatform,
  ShareIntentSchema,
  createSharingService,
  buildDeepLink,
  computeViralityMetrics,
  type SharedContent,
  type ShareIntent,
  type DeepLinkParams,
  type ViralityMetrics,
  type FriendsListening,
  type SharingRepository,
  type FriendsListeningPort,
} from './sharing'

// ── Cache Strategy ──────────────────────────────────────────────────────────
export {
  CacheKeys,
  CacheTTL,
  InvalidationPatterns,
  type CachePort,
} from './cache'
