/**
 * Internal Worker — /api/internal/workers/media-transcode
 *
 * Polls the zonga_upload_jobs queue (SELECT FOR UPDATE SKIP LOCKED)
 * and dispatches transcode jobs to AWS MediaConvert.
 *
 * Authentication: Bearer token via INTERNAL_WORKER_BEARER_TOKEN env var.
 * Invoked by: Azure Container Apps scheduled job or external cron ping.
 *
 * POST body (optional): { "batchSize": 5 }
 * Response: { ok: true, processed: N, submitted: [...jobIds], deferred: [...jobIds] }
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { withSpan } from '@nzila/os-core/telemetry'
import { withRequestContext, authenticateUser } from '@/lib/api-guards'
import { requireWorkerAuth } from '@/lib/internal-worker-auth'
import { claimNextJob, completeJob, failJob } from '@/features/media/processing-pipeline'
import { submitMediaConvertJob } from '@/features/media/media-job-service'
import { logger } from '@/lib/logger'

// ── Input schema ────────────────────────────────────────────────────────────

const BodySchema = z.object({
  batchSize: z.number().int().min(1).max(50).default(5),
})

async function parseBody(request: NextRequest): Promise<z.infer<typeof BodySchema>> {
  try {
    const body = await request.json()
    return BodySchema.parse(body ?? {})
  } catch {
    return BodySchema.parse({})
  }
}

// ── Non-transcode job types deferred until FFmpeg worker is deployed ─────────
// metadata_extract, fingerprint, and waveform require FFmpeg (services/media-worker).
// For launch, these are marked completed immediately; Sprint A adds the FFmpeg worker.
const DEFERRED_JOB_TYPES = new Set(['metadata_extract', 'fingerprint', 'waveform'])

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  return withRequestContext(request, async () => {
    // Prefer worker bearer-token auth; allow authenticated manual execution for controlled diagnostics.
    const authError = requireWorkerAuth(request)
    if (authError) {
      const userAuth = await authenticateUser()
      if (!userAuth.ok) {
        return authError
      }
    }

    return withSpan('zonga.worker.media-transcode.post', { 'http.method': 'POST' }, async () => {
      const { batchSize } = await parseBody(request)

      const submitted: string[] = []
      const deferred: string[] = []
      const failed: string[] = []

      for (let i = 0; i < batchSize; i++) {
        const job = await claimNextJob()
        if (!job) break // queue empty

        try {
          if (DEFERRED_JOB_TYPES.has(job.jobType)) {
            // Mark as completed — these job types are handled by the FFmpeg worker (post-launch)
            await completeJob(job.id)
            deferred.push(job.id)
            logger.debug('Deferred non-transcode job', { jobId: job.id, jobType: job.jobType })
            continue
          }

          // Resolve content_asset_id from track_asset_id
          const assetRows = await platformDb.execute(sql`
            SELECT content_asset_id FROM zonga_track_assets WHERE id = ${job.trackAssetId}
          `)
          const assetRow = (assetRows as unknown as Array<{ content_asset_id: string }>)[0]
          if (!assetRow) {
            await failJob(job.id, `Track asset not found: ${job.trackAssetId}`)
            failed.push(job.id)
            logger.warn('Track asset missing for upload job', { jobId: job.id, trackAssetId: job.trackAssetId })
            continue
          }

          // Submit to AWS MediaConvert
          const mediaJob = await submitMediaConvertJob({
            orgId: job.orgId,
            contentAssetId: assetRow.content_asset_id,
            inputStorageKey: job.inputKey,
            jobType: 'transcode_hls',
          })

          // Mark the upload job as completed; tracking continues in zonga_media_jobs
          await completeJob(job.id)
          submitted.push(job.id)

          logger.info('Transcode job submitted to MediaConvert', {
            uploadJobId: job.id,
            mediaJobId: mediaJob.id,
            providerJobId: mediaJob.providerJobId,
            contentAssetId: assetRow.content_asset_id,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await failJob(job.id, message)
          failed.push(job.id)
          logger.error('Failed to process upload job', { jobId: job.id, error: message })
        }
      }

      const processed = submitted.length + deferred.length + failed.length

      logger.info('Media transcode worker batch complete', {
        processed,
        submitted: submitted.length,
        deferred: deferred.length,
        failed: failed.length,
      })

      return NextResponse.json({
        ok: true,
        processed,
        submitted,
        deferred,
        failed,
      })
    })
  })
}
