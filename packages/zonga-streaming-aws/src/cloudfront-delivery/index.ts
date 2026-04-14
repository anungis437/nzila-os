/**
 * CloudFront Delivery — signed URL generation for processed media delivery.
 *
 * Produces time-limited, entitlement-gated playback URLs.
 * Zonga checks entitlements before calling these functions.
 */
import { getSignedUrl } from '@aws-sdk/cloudfront-signer'
import type { CloudFrontConfig, QualityTier } from '../types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CloudFrontPlaybackUrl {
  url: string
  expiresAt: number
  qualityTier: QualityTier
  storageKey: string
}

export interface PlaybackGrantInput {
  orgId: string
  assetId: string
  storageKey: string
  qualityTier: QualityTier
  /** Custom TTL override in seconds */
  ttlSec?: number
  /** Restrict to specific IP (optional) */
  clientIp?: string
}

export interface HlsPlaybackGrant {
  masterPlaylistUrl: string
  variantUrls: { qualityTier: QualityTier; url: string; bitrate: number }[]
  expiresAt: number
}

// ── Signed URL Generation ───────────────────────────────────────────────────

/**
 * Generate a CloudFront signed URL for a single media variant.
 */
export function createSignedPlaybackUrl(
  config: CloudFrontConfig,
  input: PlaybackGrantInput,
): CloudFrontPlaybackUrl {
  const ttl = input.ttlSec ?? config.defaultTtlSec
  const expiresAt = Math.floor(Date.now() / 1000) + ttl
  const dateLessThan = new Date(expiresAt * 1000).toISOString()

  const resourceUrl = `https://${config.distributionDomain}/${input.storageKey}`

  const signedUrl = getSignedUrl({
    url: resourceUrl,
    keyPairId: config.keyPairId,
    privateKey: config.privateKeyPem,
    dateLessThan,
  })

  return {
    url: signedUrl,
    expiresAt,
    qualityTier: input.qualityTier,
    storageKey: input.storageKey,
  }
}

/**
 * Generate signed URLs for an HLS master playlist + all variant playlists.
 * Each URL gets the same expiry window.
 */
export function createHlsPlaybackGrant(
  config: CloudFrontConfig,
  input: {
    orgId: string
    assetId: string
    variants: { storageKey: string; qualityTier: QualityTier; bitrate: number }[]
    masterPlaylistKey: string
    ttlSec?: number
  },
): HlsPlaybackGrant {
  const ttl = input.ttlSec ?? config.defaultTtlSec
  const expiresAt = Math.floor(Date.now() / 1000) + ttl
  const dateLessThan = new Date(expiresAt * 1000).toISOString()

  const masterPlaylistUrl = getSignedUrl({
    url: `https://${config.distributionDomain}/${input.masterPlaylistKey}`,
    keyPairId: config.keyPairId,
    privateKey: config.privateKeyPem,
    dateLessThan,
  })

  const variantUrls = input.variants.map((v) => ({
    qualityTier: v.qualityTier,
    bitrate: v.bitrate,
    url: getSignedUrl({
      url: `https://${config.distributionDomain}/${v.storageKey}`,
      keyPairId: config.keyPairId,
      privateKey: config.privateKeyPem,
      dateLessThan,
    }),
  }))

  return {
    masterPlaylistUrl,
    variantUrls,
    expiresAt,
  }
}

/**
 * Build CloudFront URL (unsigned) for public/cacheable resources.
 * Only use for assets that do not require entitlement gating (e.g. poster images).
 */
export function buildPublicUrl(config: CloudFrontConfig, storageKey: string): string {
  return `https://${config.distributionDomain}/${storageKey}`
}

/**
 * Compute the expected CloudFront storage keys for an asset's processed variants.
 */
export function computeVariantKeys(
  orgId: string,
  assetId: string,
  qualities: { label: string; bitrate: number }[],
): { masterKey: string; variantKeys: { label: string; bitrate: number; key: string }[] } {
  const prefix = `processed/${orgId}/${assetId}/hls`
  return {
    masterKey: `${prefix}/master.m3u8`,
    variantKeys: qualities.map((q) => ({
      label: q.label,
      bitrate: q.bitrate,
      key: `${prefix}/${q.bitrate}kbps/playlist.m3u8`,
    })),
  }
}
