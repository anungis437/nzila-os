import { sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  assertZongaContext,
  listenerFacts,
  ZongaScopeError,
  type ListenerActionContext,
} from '@/lib/resolve-org'
import { zongaRows } from '@/queries/action-context'
import { isListenerPremium, maxAudioQuality } from '@/lib/guards/subscription-guards'
import { type AudioQuality } from '@/lib/plans'
import { getAudioStreamUrl } from '@/lib/blob'
import { getPlaybackUrl } from '@/features/media/playback-service'
import { QUALITY_RANK } from '@/features/media/quality-ceiling'
import type { QualityTier } from '@/features/media/types'
import { visibleResource, audioBlobPath } from './listener-resources'
export interface DownloadResult {
  ok: boolean
  downloadUrl?: string
  error?: string
}
export interface StreamResult {
  ok: boolean
  streamUrl?: string
  quality: QualityTier
  bitrate: number
  codec: string
  error?: string
}
export async function listenerPlaybackPlan(context: ListenerActionContext) {
  assertZongaContext(context)
  const profile = await listenerFacts(context)
  const premium = !!profile && isListenerPremium(profile.plan, profile.subscriptionStatus)
  return { profile, premium, quality: maxAudioQuality(premium ? 'premium' : 'free') }
}
export async function stream(
  context: ListenerActionContext,
  id: string,
  requested?: AudioQuality,
): Promise<StreamResult> {
  const { quality: best } = await listenerPlaybackPlan(context),
    desired = z.enum(['standard', 'high', 'hifi']).optional().parse(requested) ?? best
  const quality = desired === 'hifi' && best !== 'hifi' ? best : desired
  const resource = await visibleResource(context, 'asset', id)
  const playback = await getPlaybackUrl(resource.id, quality, best, context.db)
  if (!playback.ok || !playback.streamUrl)
    return {
      ok: false,
      quality,
      bitrate: 0,
      codec: 'unknown',
      error: playback.error ?? 'Eligible processed audio is unavailable',
    }
  const fresh = await visibleResource(context, 'asset', resource.id)
  if (fresh.creatorId !== resource.creatorId || fresh.orgId !== resource.orgId)
    throw new ZongaScopeError()
  const freshPlan = await listenerPlaybackPlan(context)
  if (QUALITY_RANK[playback.qualityTier] > QUALITY_RANK[freshPlan.quality])
    throw new ZongaScopeError('Subscription changed; request playback again')
  return {
    ok: true,
    streamUrl: playback.streamUrl,
    quality: playback.qualityTier,
    bitrate: playback.bitrate,
    codec: playback.codec,
  }
}

export async function download(
  context: ListenerActionContext,
  id: string,
): Promise<DownloadResult> {
  const { profile, premium } = await listenerPlaybackPlan(context)
  if (!profile || !premium)
    return { ok: false, error: 'An active premium subscription is required for downloads' }
  const resource = await visibleResource(context, 'asset', id),
    blob = audioBlobPath(resource)
  const downloadUrl = await getAudioStreamUrl(blob, 240)
  const fresh = await visibleResource(context, 'asset', resource.id)
  if (
    fresh.storageUrl !== resource.storageUrl ||
    fresh.creatorId !== resource.creatorId ||
    fresh.orgId !== resource.orgId
  )
    throw new ZongaScopeError()
  if (!(await listenerPlaybackPlan(context)).premium)
    throw new ZongaScopeError('Subscription changed; request download again')
  const [activity] = zongaRows<{ id: string }>(
    await context.db.execute(
      sql`INSERT INTO public.zonga_listener_activity(org_id,listener_id,activity_type,entity_type,entity_id,metadata_json) VALUES(${resource.orgId},${profile.id},'download','asset',${resource.id},${JSON.stringify({ title: resource.title ?? null, source: 'verified-active-premium-download' })}::jsonb) RETURNING id`,
    ),
  )
  if (!activity) throw new Error('Download activity was not stored')
  return { ok: true, downloadUrl }
}
