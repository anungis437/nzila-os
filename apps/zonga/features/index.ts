/**
 * Zonga Features — Barrel Export
 *
 * All feature modules organized by domain concern.
 * Each feature encapsulates types, services, and constants
 * for a single domain slice.
 */

// Media infrastructure
export * from './media/types'
export * from './media/processing-pipeline'
export * from './media/upload-service'
export * from './media/playback-service'

// Creator operations
export * from './creator/types'
export * from './creator/publishing-workflow'
export * from './creator/dashboard-service'

// Catalog / discovery
export * from './catalog/types'
export * from './discovery/trending-calculator'
export * from './discovery/search-service'
export * from './discovery/ranking-service'

// Events / ticketing
export * from './events/types'
export * from './events/event-lifecycle'
export * from './events/ticket-service'
export * from './events/checkin-service'

// Monetization
export * from './payouts/types'
export * from './payouts/earnings-ledger'
export * from './payouts/payout-service'
export * from './payouts/revenue-split'

// Rights / governance
export * from './rights/types'
export * from './rights/ownership-service'
export * from './rights/moderation-service'
export * from './rights/takedown-service'

// Analytics
export * from './analytics/types'
export * from './analytics/platform-analytics'

// Safety / fraud prevention
export * from './safety/duplicate-detection'

// Nzila OS integration
export * from './nzila-integration/sync-service'

// Admin / observability
export * from './admin/observability-dashboard'
