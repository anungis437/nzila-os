/**
 * Zonga — Analytics Domain Types
 */

export interface PlatformHealthSnapshot {
  id: string
  orgId: string
  period: string           // YYYY-MM-DD or YYYY-MM
  totalTracks: number
  totalArtists: number
  totalListeners: number
  totalEvents: number
  totalStreams: number
  totalRevenue: number
  activeCreators: number   // creators with ≥1 upload in period
  newSignups: number
  avgStreamDuration: number
  topGenre: string
  snapshotAt: Date
}

export interface CreatorAnalytics {
  creatorId: string
  orgId: string
  totalTracks: number
  totalStreams: number
  totalEarnings: number
  totalFollowers: number
  avgDailyStreams: number
  topTrackId?: string
  topTrackTitle?: string
  topTrackStreams: number
  streamsByCountry: Record<string, number>
  streamsByGenre: Record<string, number>
  earningsByMonth: Array<{ month: string; amount: number }>
}

export interface ContentPerformance {
  contentId: string
  contentType: 'track' | 'release' | 'event'
  title: string
  totalStreams: number
  uniqueListeners: number
  saves: number
  shares: number
  avgCompletionRate: number
  revenueGenerated: number
  trendingScore: number
  listenerRetention: number  // % listeners who came back
}
