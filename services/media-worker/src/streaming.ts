/**
 * @nzila/media-worker — Streaming Delivery Service
 *
 * Serves HLS streams with signed URLs for premium content,
 * handles quality negotiation, bandwidth detection, and
 * CDN edge routing.
 *
 * @module @nzila/media-worker/streaming
 */

import type { StorageProvider } from './storage'
import { hlsManifestPath, hlsVariantPath, hlsSegmentPath, processedPath } from './storage'
import type { QualityTier } from './transcoder'

// ── Stream Access Control ───────────────────────────────────────────────────

export const STREAM_ACCESS_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  CREATOR: 'creator',
} as const

export type StreamAccessTier = (typeof STREAM_ACCESS_TIERS)[keyof typeof STREAM_ACCESS_TIERS]

export interface StreamAccessPolicy {
  /** Maximum quality tier a user can access. */
  readonly maxQuality: QualityTier
  /** Whether HLS adaptive streaming is available. */
  readonly hlsEnabled: boolean
  /** Whether offline download is allowed. */
  readonly offlineEnabled: boolean
  /** Sign URLs with time-limited tokens. */
  readonly requireSignedUrls: boolean
  /** URL expiration in seconds. */
  readonly urlTtlSeconds: number
}

const ACCESS_POLICIES: Record<StreamAccessTier, StreamAccessPolicy> = {
  [STREAM_ACCESS_TIERS.FREE]: {
    maxQuality: 'medium',
    hlsEnabled: false,
    offlineEnabled: false,
    requireSignedUrls: false,
    urlTtlSeconds: 3600,
  },
  [STREAM_ACCESS_TIERS.PREMIUM]: {
    maxQuality: 'high',
    hlsEnabled: true,
    offlineEnabled: true,
    requireSignedUrls: true,
    urlTtlSeconds: 14400,
  },
  [STREAM_ACCESS_TIERS.CREATOR]: {
    maxQuality: 'high',
    hlsEnabled: true,
    offlineEnabled: true,
    requireSignedUrls: true,
    urlTtlSeconds: 86400,
  },
}

export function getAccessPolicy(tier: StreamAccessTier): StreamAccessPolicy {
  return ACCESS_POLICIES[tier]
}

// ── Stream URL Resolution ───────────────────────────────────────────────────

export interface StreamUrlRequest {
  readonly assetId: string
  readonly listenerId: string
  readonly accessTier: StreamAccessTier
  readonly preferredQuality: QualityTier
  readonly protocol: 'hls' | 'progressive'
  readonly lowDataMode: boolean
}

export interface StreamUrlResponse {
  readonly url: string
  readonly protocol: 'hls' | 'progressive'
  readonly quality: QualityTier
  readonly expiresAt: Date
  readonly hlsManifestUrl: string | null
  readonly progressiveFallbackUrl: string | null
}

/**
 * Creates the streaming delivery service.
 * Resolves stream URLs based on access policy, quality availability,
 * and client capabilities.
 */
export function createStreamingDeliveryService(deps: {
  storage: StorageProvider
  cdnBaseUrl: string
}) {
  const { storage, cdnBaseUrl } = deps

  return {
    /**
     * Resolve best stream URL for a listener.
     * Enforces access policies, quality caps, and low-data mode.
     */
    async resolveStreamUrl(request: StreamUrlRequest): Promise<StreamUrlResponse> {
      const policy = getAccessPolicy(request.accessTier)

      // Resolve effective quality
      const effectiveQuality = resolveQuality(
        request.preferredQuality,
        policy.maxQuality,
        request.lowDataMode,
      )

      const now = new Date()
      const expiresAt = new Date(now.getTime() + policy.urlTtlSeconds * 1000)

      // Try HLS first if supported
      if (request.protocol === 'hls' && policy.hlsEnabled) {
        const manifestKey = hlsManifestPath(request.assetId)
        const manifestExists = await storage.exists(manifestKey)

        if (manifestExists) {
          const url = policy.requireSignedUrls
            ? await storage.getSignedUrl(manifestKey, policy.urlTtlSeconds)
            : `${cdnBaseUrl}/${manifestKey}`

          // Also get progressive fallback
          const fallbackKey = processedPath(request.assetId, effectiveQuality)
          const fallbackUrl = policy.requireSignedUrls
            ? await storage.getSignedUrl(fallbackKey, policy.urlTtlSeconds)
            : `${cdnBaseUrl}/${fallbackKey}`

          return {
            url,
            protocol: 'hls',
            quality: effectiveQuality,
            expiresAt,
            hlsManifestUrl: url,
            progressiveFallbackUrl: fallbackUrl,
          }
        }
      }

      // Progressive download/stream
      const progressiveKey = processedPath(request.assetId, effectiveQuality)
      const url = policy.requireSignedUrls
        ? await storage.getSignedUrl(progressiveKey, policy.urlTtlSeconds)
        : `${cdnBaseUrl}/${progressiveKey}`

      return {
        url,
        protocol: 'progressive',
        quality: effectiveQuality,
        expiresAt,
        hlsManifestUrl: null,
        progressiveFallbackUrl: null,
      }
    },

    /**
     * Generate signed URLs for all HLS segments of a quality tier.
     * Used for offline download packaging.
     */
    async getOfflinePackageUrls(params: {
      assetId: string
      quality: QualityTier
      accessTier: StreamAccessTier
    }): Promise<{ readonly urls: readonly string[]; readonly expiresAt: Date } | null> {
      const policy = getAccessPolicy(params.accessTier)
      if (!policy.offlineEnabled) return null

      const qualityRank = QUALITY_RANK[params.quality]
      const maxRank = QUALITY_RANK[policy.maxQuality]
      if (qualityRank > maxRank) return null

      // List all segments for this quality
      const prefix = `audio/hls/${params.assetId}/${params.quality}/`
      const objects = await storage.list(prefix)

      const urls: string[] = []
      for (const obj of objects) {
        const url = await storage.getSignedUrl(obj.key, policy.urlTtlSeconds)
        urls.push(url)
      }

      return {
        urls,
        expiresAt: new Date(Date.now() + policy.urlTtlSeconds * 1000),
      }
    },
  }
}

// ── Quality Resolution (pure) ───────────────────────────────────────────────

const QUALITY_RANK: Record<QualityTier, number> = {
  low: 0,
  medium: 1,
  high: 2,
}

/**
 * Resolve effective quality based on request, policy cap, and low-data mode.
 */
export function resolveQuality(
  preferred: QualityTier,
  maxAllowed: QualityTier,
  lowDataMode: boolean,
): QualityTier {
  if (lowDataMode) return 'low'

  const preferredRank = QUALITY_RANK[preferred]
  const maxRank = QUALITY_RANK[maxAllowed]

  if (preferredRank <= maxRank) return preferred
  return maxAllowed
}
