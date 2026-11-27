/** Existing premium offline access, without fabricated organization evidence. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  download,
  listenerPlaybackPlan,
  type DownloadResult,
} from '@/lib/services/listener-playback'
export type { DownloadResult } from '@/lib/services/listener-playback'
export async function requestDownload(assetId: string): Promise<DownloadResult> {
  return resolveOrgContext('personal', (context) => download(context, assetId))
}
export async function canDownload(): Promise<{ allowed: boolean; reason?: string }> {
  return resolveOrgContext('personal', async (context) => {
    const { premium } = await listenerPlaybackPlan(context)
    return premium
      ? { allowed: true }
      : { allowed: false, reason: 'An active premium subscription is required for downloads' }
  })
}
