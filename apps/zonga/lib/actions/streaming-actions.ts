/** Authenticated published audio with actual owned active-plan entitlement. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import { stream, listenerPlaybackPlan, type StreamResult } from '@/lib/services/listener-playback'
import { AUDIO_QUALITY, type AudioQuality } from '@/lib/plans'
export type { StreamResult } from '@/lib/services/listener-playback'
export async function requestStream(
  assetId: string,
  requestedQuality?: AudioQuality,
): Promise<StreamResult> {
  return resolveOrgContext('personal', (context) => stream(context, assetId, requestedQuality))
}
export async function getMaxQuality(): Promise<{
  quality: AudioQuality
  bitrate: number
  codec: string
  label: string
}> {
  return resolveOrgContext('personal', async (context) => {
    const { quality } = await listenerPlaybackPlan(context)
    return { quality, ...AUDIO_QUALITY[quality] }
  })
}
