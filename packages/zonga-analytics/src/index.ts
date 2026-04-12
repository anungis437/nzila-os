/**
 * @nzila/zonga-analytics — Event tracking, metrics computation, and dashboard aggregation.
 *
 * Tracks: plays, skips, sessions, retention, DAU/MAU.
 * Provides creator + admin dashboard data via pure aggregation functions.
 */

// ── Event Tracking ──────────────────────────────────────────────────────────
export {
  createPlayEvent,
  createSkipEvent,
  createSearchEvent,
  createShareEvent,
  createSessionEvent,
  classifyEngagement,
  type AnalyticsEvent,
  type PlayEvent,
  type SkipEvent,
  type SearchEvent,
  type ShareEvent,
  type SessionEvent,
  type EngagementLevel,
} from './events/index'

// ── Metrics Computation ─────────────────────────────────────────────────────
export {
  computeDAU,
  computeMAU,
  computeRetention,
  computeSessionMetrics,
  computeSkipRate,
  computeCompletionRate,
  computeListenerSegments,
  type DailyActiveUsers,
  type MonthlyActiveUsers,
  type RetentionCohort,
  type SessionMetrics,
  type ListenerSegment,
} from './metrics/index'

// ── Dashboard Aggregation ───────────────────────────────────────────────────
export {
  aggregateCreatorDashboard,
  aggregateAdminDashboard,
  computeTopTracks,
  computeTopCountries,
  computeRevenueTimeline,
  computeListenerGrowth,
  type CreatorDashboardData,
  type AdminDashboardData,
  type TopTrackEntry,
  type GeoDistribution,
  type TimelinePoint,
} from './dashboards/index'
