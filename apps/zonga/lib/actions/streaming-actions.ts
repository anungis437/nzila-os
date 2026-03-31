/**
 * Zonga Server Actions — Quality-Gated Streaming.
 *
 * Audio quality tier enforcement (S5 guard).
 * Free listeners get standard/high quality; premium gets hi-fi lossless.
 */
'use server'

import { resolveListenerContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getListenerPlan } from '@/lib/guards/plan-queries'
import { guardAudioQuality, maxAudioQuality } from '@/lib/guards/subscription-guards'
import { AUDIO_QUALITY, type AudioQuality } from '@/lib/plans'
import { getAudioStreamUrl } from '@/lib/blob'

export interface StreamResult {
  ok: boolean
  streamUrl?: string
  quality: AudioQuality
  bitrate: number
  codec: string
  error?: string
}

/**
 * Request a streaming URL at a specific quality tier.
 * S5 guard enforces: free → standard/high only, premium → all including hifi.
 */
export async function requestStream(
  assetId: string,
  requestedQuality?: AudioQuality,
): Promise<StreamResult> {
  const ctx = await resolveListenerContext()

  try {
    const planInfo = await getListenerPlan(ctx.actorId, ctx.orgId)
    const bestQuality = maxAudioQuality(planInfo.plan)
    const quality = requestedQuality ?? bestQuality

    // S5: enforce audio quality tier
    const qualityCheck = guardAudioQuality(planInfo.plan, quality)
    if (!qualityCheck.passed) {
      // Downgrade to the best available quality instead of blocking
      const fallback = bestQuality
      const tier = AUDIO_QUALITY[fallback]

      const [asset] = (await platformDb.execute(
        sql`SELECT storage_url FROM zonga_content_assets
        WHERE id = ${assetId} AND status = 'published'`,
      )) as unknown as [{ storage_url: string | null } | undefined]

      if (!asset?.storage_url) {
        return { ok: false, quality: fallback, bitrate: tier.bitrate, codec: tier.codec, error: 'Asset not found' }
      }

      const blobPath = asset.storage_url.replace('blob://', '')
      const streamUrl = await getAudioStreamUrl(blobPath)

      return {
        ok: true,
        streamUrl,
        quality: fallback,
        bitrate: tier.bitrate,
        codec: tier.codec,
      }
    }

    const tier = AUDIO_QUALITY[quality]

    const [asset] = (await platformDb.execute(
      sql`SELECT storage_url FROM zonga_content_assets
      WHERE id = ${assetId} AND status = 'published'`,
    )) as unknown as [{ storage_url: string | null } | undefined]

    if (!asset?.storage_url) {
      return { ok: false, quality, bitrate: tier.bitrate, codec: tier.codec, error: 'Asset not found' }
    }

    const blobPath = asset.storage_url.replace('blob://', '')
    const streamUrl = await getAudioStreamUrl(blobPath)

    logger.info('Stream granted', { listenerId: ctx.actorId, assetId, quality })
    return {
      ok: true,
      streamUrl,
      quality,
      bitrate: tier.bitrate,
      codec: tier.codec,
    }
  } catch (error) {
    logger.error('requestStream failed', { error })
    return { ok: false, quality: 'standard', bitrate: 128, codec: 'aac', error: 'Streaming failed' }
  }
}

/**
 * Get the maximum audio quality available for the current listener's plan.
 */
export async function getMaxQuality(): Promise<{
  quality: AudioQuality
  bitrate: number
  codec: string
  label: string
}> {
  const ctx = await resolveListenerContext()
  const planInfo = await getListenerPlan(ctx.actorId, ctx.orgId)
  const quality = maxAudioQuality(planInfo.plan)
  const tier = AUDIO_QUALITY[quality]

  return {
    quality,
    bitrate: tier.bitrate,
    codec: tier.codec,
    label: tier.label,
  }
}
