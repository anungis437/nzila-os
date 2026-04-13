/**
 * CDN delivery — URL signing, adaptive bitrate selection, stream URL resolution.
 */
import { QUALITY_PRESETS, type TranscodeQuality } from '../transcode/index'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CdnConfig {
  baseUrl: string
  signingSecret: string
  tokenTtlSec: number
  region?: string
}

export interface SignedUrlParams {
  path: string
  expiresAt: number  // Unix timestamp
  clientIp?: string
  token: string
}

export interface StreamDeliveryContext {
  assetId: string
  listenerId: string | null
  plan: 'free' | 'premium'
  networkType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown'
  deviceType: 'mobile' | 'tablet' | 'desktop'
  lowDataMode: boolean
  country?: string
}

// ── Adaptive Quality Selection ──────────────────────────────────────────────

/**
 * Select the optimal streaming quality based on user context.
 *
 * This implements real adaptive bitrate logic:
 * - Free users cap at 128kbps
 * - Premium users get up to 320kbps
 * - Network-aware downgrade on slow connections
 * - Low data mode forces lowest quality
 */
export function selectOptimalQuality(
  ctx: StreamDeliveryContext,
  availableQualities: TranscodeQuality[]
): TranscodeQuality {
  if (availableQualities.length === 0) {
    return QUALITY_PRESETS['normal']!
  }

  // Sort by bitrate ascending
  const sorted = [...availableQualities].sort((a, b) => a.bitrate - b.bitrate)

  // Low data mode: always use lowest
  if (ctx.lowDataMode) {
    return sorted[0]!
  }

  // Free users: cap at 128kbps
  const maxBitrate = ctx.plan === 'free' ? 128 : 320

  // Network-aware bitrate ceiling
  const networkCeiling = getNetworkBitrateCeiling(ctx.networkType)
  const effectiveMax = Math.min(maxBitrate, networkCeiling)

  // Select highest quality that fits within ceiling
  let best = sorted[0]!
  for (const q of sorted) {
    if (q.bitrate <= effectiveMax) {
      best = q
    }
  }

  return best
}

function getNetworkBitrateCeiling(networkType: StreamDeliveryContext['networkType']): number {
  switch (networkType) {
    case 'slow-2g': return 64
    case '2g': return 64
    case '3g': return 128
    case '4g': return 320
    case 'wifi': return 320
    default: return 256
  }
}

// ── Stream URL Resolution ───────────────────────────────────────────────────

/**
 * Resolve the full stream URL for a given asset and delivery context.
 * Returns the CDN-signed manifest URL for the selected quality.
 */
export function resolveStreamUrl(
  assetId: string,
  ctx: StreamDeliveryContext,
  availableQualities: TranscodeQuality[],
  cdn: CdnConfig
): { url: string; quality: TranscodeQuality; signed: SignedUrlParams } {
  const quality = selectOptimalQuality(ctx, availableQualities)
  const path = `assets/${assetId}/audio/${quality.bitrate}kbps/playlist.m3u8`
  const signed = computeCdnSignedUrl(path, cdn)

  return {
    url: `${cdn.baseUrl}/${path}?token=${signed.token}&expires=${signed.expiresAt}`,
    quality,
    signed,
  }
}

// ── CDN URL Signing ─────────────────────────────────────────────────────────

/**
 * Compute a time-limited signed URL for CDN access.
 * Uses HMAC-like approach — in production this would use the CDN provider's signing SDK.
 *
 * The token is a deterministic hash of: path + expiry + secret.
 * This prevents URL tampering and enforces TTL.
 */
export function computeCdnSignedUrl(
  path: string,
  cdn: CdnConfig,
  clientIp?: string
): SignedUrlParams {
  const expiresAt = Math.floor(Date.now() / 1000) + cdn.tokenTtlSec

  // Deterministic token: base64(path:expires:region)
  // In production, use crypto.createHmac('sha256', cdn.signingSecret)
  const payload = `${path}:${expiresAt}:${cdn.region ?? 'global'}`
  const token = deterministicHash(payload, cdn.signingSecret)

  return {
    path,
    expiresAt,
    clientIp,
    token,
  }
}

/**
 * Deterministic hash for URL signing.
 * Uses a simple FNV-1a style hash for portability (no Node crypto dep).
 * In production, swap for HMAC-SHA256.
 */
function deterministicHash(input: string, secret: string): string {
  const combined = `${secret}:${input}`
  let hash = 2166136261
  for (let i = 0; i < combined.length; i++) {
    hash ^= combined.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // Convert to hex string
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// ── Adaptive Bitrate Manifest ───────────────────────────────────────────────

/**
 * Build an adaptive bitrate manifest URL set for a complete streaming session.
 * Returns the master manifest URL and individual quality URLs.
 */
export function buildAdaptiveBitrateManifest(
  assetId: string,
  availableQualities: TranscodeQuality[],
  cdn: CdnConfig
): {
  masterUrl: string
  qualityUrls: { label: string; bitrate: number; url: string }[]
} {
  const masterPath = `assets/${assetId}/audio/master.m3u8`
  const masterSigned = computeCdnSignedUrl(masterPath, cdn)

  const qualityUrls = availableQualities.map((q) => {
    const path = `assets/${assetId}/audio/${q.bitrate}kbps/playlist.m3u8`
    const signed = computeCdnSignedUrl(path, cdn)
    return {
      label: q.label,
      bitrate: q.bitrate,
      url: `${cdn.baseUrl}/${path}?token=${signed.token}&expires=${signed.expiresAt}`,
    }
  })

  return {
    masterUrl: `${cdn.baseUrl}/${masterPath}?token=${masterSigned.token}&expires=${masterSigned.expiresAt}`,
    qualityUrls,
  }
}
