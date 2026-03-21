/**
 * @nzila/zonga-growth — Viral Loops & Sharing
 *
 * Deep link generation, share tracking, referral attribution,
 * "friends listening" feed, and virality metrics.
 *
 * @module @nzila/zonga-growth/sharing
 */

import { z } from 'zod'

// ── Types ───────────────────────────────────────────────────────────────────

export const ShareType = {
  TRACK: 'track',
  PLAYLIST: 'playlist',
  EVENT: 'event',
  ARTIST: 'artist',
} as const
export type ShareType = (typeof ShareType)[keyof typeof ShareType]

export const SharePlatform = {
  WHATSAPP: 'whatsapp',
  TWITTER: 'twitter',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  TELEGRAM: 'telegram',
  SMS: 'sms',
  COPY_LINK: 'copy_link',
  OTHER: 'other',
} as const
export type SharePlatform = (typeof SharePlatform)[keyof typeof SharePlatform]

export interface SharedContent {
  readonly id: string
  readonly orgId: string
  readonly sharerId: string
  readonly shareType: ShareType
  readonly contentId: string
  readonly deepLink: string
  readonly platform: SharePlatform | null
  readonly clickCount: number
  readonly createdAt: string
}

export interface ShareIntent {
  readonly orgId: string
  readonly sharerId: string
  readonly shareType: ShareType
  readonly contentId: string
  readonly platform?: SharePlatform
}

export interface DeepLinkParams {
  readonly baseUrl: string
  readonly shareType: ShareType
  readonly contentId: string
  readonly shareId: string
  readonly utm?: {
    source?: string
    medium?: string
    campaign?: string
  }
}

export interface ViralityMetrics {
  readonly totalShares: number
  readonly totalClicks: number
  readonly clickThroughRate: number
  readonly topPlatform: SharePlatform | null
  readonly topContent: { contentId: string; shares: number } | null
}

export interface FriendsListening {
  readonly userId: string
  readonly assetId: string
  readonly startedAt: string
}

// ── Schemas ─────────────────────────────────────────────────────────────────

export const ShareIntentSchema = z.object({
  orgId: z.string().uuid(),
  sharerId: z.string().uuid(),
  shareType: z.enum(['track', 'playlist', 'event', 'artist']),
  contentId: z.string().uuid(),
  platform: z
    .enum([
      'whatsapp',
      'twitter',
      'instagram',
      'facebook',
      'telegram',
      'sms',
      'copy_link',
      'other',
    ])
    .optional(),
})

// ── Pure Helpers ────────────────────────────────────────────────────────────

/**
 * Builds a deep link URL for sharing.
 * Uses path-based routing for clean URLs.
 */
export function buildDeepLink(params: DeepLinkParams): string {
  const pathMap: Record<ShareType, string> = {
    track: 'track',
    playlist: 'playlist',
    event: 'event',
    artist: 'artist',
  }

  const path = pathMap[params.shareType]
  const url = new URL(`/${path}/${params.contentId}`, params.baseUrl)
  url.searchParams.set('ref', params.shareId)

  if (params.utm) {
    if (params.utm.source) url.searchParams.set('utm_source', params.utm.source)
    if (params.utm.medium) url.searchParams.set('utm_medium', params.utm.medium)
    if (params.utm.campaign) url.searchParams.set('utm_campaign', params.utm.campaign)
  }

  return url.toString()
}

/**
 * Computes virality metrics from a set of shared content records.
 */
export function computeViralityMetrics(
  shares: readonly SharedContent[],
): ViralityMetrics {
  if (shares.length === 0) {
    return {
      totalShares: 0,
      totalClicks: 0,
      clickThroughRate: 0,
      topPlatform: null,
      topContent: null,
    }
  }

  const totalShares = shares.length
  const totalClicks = shares.reduce((sum, s) => sum + s.clickCount, 0)

  // Count by platform
  const platformCounts = new Map<string, number>()
  for (const share of shares) {
    if (share.platform) {
      platformCounts.set(
        share.platform,
        (platformCounts.get(share.platform) ?? 0) + 1,
      )
    }
  }

  let topPlatform: SharePlatform | null = null
  let topPlatformCount = 0
  for (const [platform, count] of platformCounts) {
    if (count > topPlatformCount) {
      topPlatform = platform as SharePlatform
      topPlatformCount = count
    }
  }

  // Count by content
  const contentCounts = new Map<string, number>()
  for (const share of shares) {
    contentCounts.set(
      share.contentId,
      (contentCounts.get(share.contentId) ?? 0) + 1,
    )
  }

  let topContent: { contentId: string; shares: number } | null = null
  let topContentCount = 0
  for (const [contentId, count] of contentCounts) {
    if (count > topContentCount) {
      topContent = { contentId, shares: count }
      topContentCount = count
    }
  }

  return {
    totalShares,
    totalClicks,
    clickThroughRate: totalShares > 0 ? totalClicks / totalShares : 0,
    topPlatform,
    topContent,
  }
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface SharingRepository {
  insertShare(
    share: Omit<SharedContent, 'id' | 'clickCount' | 'createdAt'>,
  ): Promise<SharedContent>
  findShareById(shareId: string): Promise<SharedContent | null>
  incrementClickCount(shareId: string): Promise<void>
  listSharesByUser(
    orgId: string,
    userId: string,
    limit: number,
    offset: number,
  ): Promise<readonly SharedContent[]>
  listSharesByEntity(
    orgId: string,
    contentId: string,
    limit: number,
    offset: number,
  ): Promise<readonly SharedContent[]>
  getSharesForPeriod(
    orgId: string,
    startDate: string,
    endDate: string,
  ): Promise<readonly SharedContent[]>
}

export interface FriendsListeningPort {
  getActiveListeners(
    orgId: string,
    friendIds: readonly string[],
  ): Promise<readonly FriendsListening[]>
}

// ── Sharing Service ─────────────────────────────────────────────────────────

export function createSharingService(deps: {
  repo: SharingRepository
  friends: FriendsListeningPort
  baseUrl: string
}) {
  const { repo, friends, baseUrl } = deps

  return {
    /**
     * Create a share — generates deep link and persists.
     */
    async share(intent: ShareIntent): Promise<SharedContent> {
      // Validate
      ShareIntentSchema.parse(intent)

      // Generate a temporary ID for deep link embedding
      const shareStub = await repo.insertShare({
        orgId: intent.orgId,
        sharerId: intent.sharerId,
        shareType: intent.shareType,
        contentId: intent.contentId,
        deepLink: '', // will update below
        platform: intent.platform ?? null,
      })

      // Build deep link with share ID for attribution
      const deepLink = buildDeepLink({
        baseUrl,
        shareType: intent.shareType,
        contentId: intent.contentId,
        shareId: shareStub.id,
        utm: {
          source: intent.platform ?? 'direct',
          medium: 'share',
          campaign: `${intent.shareType}_share`,
        },
      })

      // Update with actual deep link
      // In production this would be an update, here we return the constructed result
      return {
        ...shareStub,
        deepLink,
      }
    },

    /**
     * Track a click on a shared link (attribution).
     */
    async trackClick(shareId: string): Promise<SharedContent | null> {
      const share = await repo.findShareById(shareId)
      if (!share) return null

      await repo.incrementClickCount(shareId)
      return { ...share, clickCount: share.clickCount + 1 }
    },

    /**
     * Get virality metrics for a time period.
     */
    async getViralityMetrics(params: {
      orgId: string
      startDate: string
      endDate: string
    }): Promise<ViralityMetrics> {
      const shares = await repo.getSharesForPeriod(
        params.orgId,
        params.startDate,
        params.endDate,
      )
      return computeViralityMetrics(shares)
    },

    /**
     * "Friends Listening" — real-time feed of what friends are playing.
     */
    async getFriendsListening(params: {
      orgId: string
      friendIds: readonly string[]
    }): Promise<readonly FriendsListening[]> {
      if (params.friendIds.length === 0) return []
      return friends.getActiveListeners(params.orgId, params.friendIds)
    },

    /**
     * Get shares by a specific user.
     */
    async getUserShares(params: {
      orgId: string
      userId: string
      limit?: number
      offset?: number
    }): Promise<readonly SharedContent[]> {
      const limit = Math.min(params.limit ?? 20, 100)
      const offset = Math.max(params.offset ?? 0, 0)
      return repo.listSharesByUser(params.orgId, params.userId, limit, offset)
    },
  }
}
