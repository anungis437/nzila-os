/**
 * Zonga — AWS Media Job Service
 *
 * Orchestrates MediaConvert transcode jobs and manages the
 * zonga_media_jobs / zonga_media_variants tables.
 * Coordinates between the Zonga processing pipeline and
 * the AWS provider package.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { MediaJobStatus, MediaJobType, QualityTier } from '@nzila/zonga-streaming-aws'

// ── Types ───────────────────────────────────────────────────────────────────

export interface MediaJob {
  id: string
  orgId: string
  contentAssetId: string
  provider: string
  providerJobId: string | null
  jobType: MediaJobType
  status: MediaJobStatus
  submittedAt: string | null
  completedAt: string | null
  errorSummary: string | null
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface MediaVariant {
  id: string
  contentAssetId: string
  provider: string
  storageKey: string
  deliveryUrlRef: string | null
  qualityTier: QualityTier
  bitrate: number | null
  codec: string | null
  format: string | null
  durationSeconds: number | null
  status: string
  createdAt: string
  updatedAt: string
}

// ── Submit & Track MediaConvert Jobs ────────────────────────────────────────

/**
 * Submit a transcode job to AWS MediaConvert and record it in the DB.
 */
export async function submitMediaConvertJob(params: {
  orgId: string
  contentAssetId: string
  inputStorageKey: string
  jobType?: MediaJobType
}): Promise<MediaJob> {
  const { orgId, contentAssetId, inputStorageKey, jobType = 'transcode_hls' } = params

  const { submitTranscodeJob } = await import('@nzila/zonga-streaming-aws/mediaconvert')
  const { resolveMediaConvertConfig, resolveS3Config } = await import('@nzila/zonga-streaming-aws')

  const mcConfig = resolveMediaConvertConfig()
  const s3Config = resolveS3Config()

  const result = await submitTranscodeJob(mcConfig, {
    inputBucket: s3Config.rawBucket,
    inputStorageKey: inputStorageKey,
    assetId: contentAssetId,
    orgId,
    jobType,
    qualities: [
      { label: 'standard', bitrate: 128, codec: 'aac', container: 'fmp4', sampleRate: 44100 },
      { label: 'high', bitrate: 256, codec: 'aac', container: 'fmp4', sampleRate: 44100 },
    ],
  })

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_media_jobs (
      org_id, content_asset_id, provider, provider_job_id,
      job_type, status, submitted_at, metadata_json
    ) VALUES (
      ${orgId}, ${contentAssetId}, 'aws_mediaconvert',
      ${result.providerJobId}, ${jobType}, ${result.status},
      now(), ${JSON.stringify({ outputPrefix: result.outputPrefix })}::jsonb
    )
    RETURNING *
  `)

  const job = mapJobRow((rows as unknown as Array<Record<string, unknown>>)[0]!)
  logger.info('MediaConvert job submitted', {
    jobId: job.id,
    providerJobId: result.providerJobId,
    contentAssetId,
  })

  return job
}

/**
 * Poll MediaConvert for job status and update the DB.
 * If completed, register output variants.
 */
export async function reconcileMediaJob(jobId: string): Promise<MediaJob> {
  const job = await getMediaJob(jobId)
  if (!job) throw new Error(`Media job not found: ${jobId}`)
  if (!job.providerJobId) throw new Error('Job has no provider reference')
  if (job.status === 'completed' || job.status === 'cancelled') return job

  const { getTranscodeJobStatus } = await import('@nzila/zonga-streaming-aws/mediaconvert')
  const { resolveMediaConvertConfig } = await import('@nzila/zonga-streaming-aws')

  const status = await getTranscodeJobStatus(resolveMediaConvertConfig(), job.providerJobId)

  // Update job status
  await platformDb.execute(sql`
    UPDATE zonga_media_jobs
    SET status = ${status.status},
        error_summary = ${status.errorMessage ?? null},
        completed_at = CASE WHEN ${status.status} IN ('completed', 'failed', 'cancelled')
                       THEN now() ELSE completed_at END,
        metadata_json = metadata_json || ${JSON.stringify({
          progress: status.progress,
          outputKeys: status.outputKeys,
        })}::jsonb,
        updated_at = now()
    WHERE id = ${jobId}
  `)

  // If completed, register variants
  if (status.status === 'completed' && status.outputKeys?.length) {
    await registerOutputVariants(job.contentAssetId, job.orgId, status.outputKeys)
  }

  logger.info('Media job reconciled', {
    jobId,
    status: status.status,
    progress: status.progress,
  })

  return { ...job, status: status.status as MediaJobStatus }
}

/**
 * Register completed transcode output files as media variants.
 */
async function registerOutputVariants(
  contentAssetId: string,
  _orgId: string,
  outputKeys: string[],
): Promise<void> {
  for (const key of outputKeys) {
    // Infer quality tier and format from key path
    const tier = inferQualityTier(key)
    const format = inferFormat(key)

    await platformDb.execute(sql`
      INSERT INTO zonga_media_variants (
        content_asset_id, provider, storage_key,
        quality_tier, format, status
      ) VALUES (
        ${contentAssetId}, 'aws_mediaconvert', ${key},
        ${tier}, ${format}, 'ready'
      )
      ON CONFLICT (content_asset_id, quality_tier, provider)
        DO UPDATE SET storage_key = ${key}, format = ${format},
                      status = 'ready', updated_at = now()
    `)
  }
}

// ── Query Functions ─────────────────────────────────────────────────────────

export async function getMediaJob(jobId: string): Promise<MediaJob | null> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_media_jobs WHERE id = ${jobId}
  `)
  const row = (rows as unknown as Array<Record<string, unknown>>)[0]
  return row ? mapJobRow(row) : null
}

export async function getMediaJobsForAsset(
  contentAssetId: string,
): Promise<MediaJob[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_media_jobs
    WHERE content_asset_id = ${contentAssetId}
    ORDER BY created_at DESC
  `)
  return (rows as unknown as Array<Record<string, unknown>>).map(mapJobRow)
}

export async function getMediaVariantsForAsset(
  contentAssetId: string,
): Promise<MediaVariant[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_media_variants
    WHERE content_asset_id = ${contentAssetId}
    ORDER BY quality_tier ASC
  `)
  return (rows as unknown as Array<Record<string, unknown>>).map(mapVariantRow)
}

/**
 * Get the best available CloudFront-backed variant for an asset.
 */
export async function getBestMediaVariant(
  contentAssetId: string,
  preferredQuality?: QualityTier,
): Promise<MediaVariant | null> {
  const tiers: QualityTier[] = preferredQuality
    ? [preferredQuality, 'high', 'standard', 'preview']
    : ['high', 'standard', 'preview']
  const uniqueTiers = [...new Set(tiers)]

  for (const tier of uniqueTiers) {
    const rows = await platformDb.execute(sql`
      SELECT * FROM zonga_media_variants
      WHERE content_asset_id = ${contentAssetId}
        AND quality_tier = ${tier}
        AND status = 'ready'
      LIMIT 1
    `)
    const row = (rows as unknown as Array<Record<string, unknown>>)[0]
    if (row) return mapVariantRow(row)
  }
  return null
}

/**
 * Get pending/in-progress media jobs for monitoring.
 */
export async function getActiveMediaJobs(orgId?: string): Promise<MediaJob[]> {
  const orgFilter = orgId ? sql`AND org_id = ${orgId}` : sql``
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_media_jobs
    WHERE status IN ('pending', 'submitted', 'processing')
    ${orgFilter}
    ORDER BY submitted_at ASC
  `)
  return (rows as unknown as Array<Record<string, unknown>>).map(mapJobRow)
}

/**
 * Get aggregate stats for the streaming dashboard.
 */
export async function getStreamingStats(orgId?: string): Promise<{
  totalStreams: number
  activeStreams: number
  totalMediaJobs: number
  completedJobs: number
  failedJobs: number
  totalVariants: number
}> {
  const orgFilter = orgId ? sql`WHERE org_id = ${orgId}` : sql``
  const streamOrgFilter = orgId ? sql`WHERE org_id = ${orgId}` : sql``

  const streamRows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status IN ('live', 'ready'))::int as active
    FROM zonga_live_streams
    ${streamOrgFilter}
  `)
  const stream = (streamRows as unknown as Array<Record<string, unknown>>)[0]

  const jobRows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
      COUNT(*) FILTER (WHERE status = 'failed')::int as failed
    FROM zonga_media_jobs
    ${orgFilter}
  `)
  const job = (jobRows as unknown as Array<Record<string, unknown>>)[0]

  const variantRows = await platformDb.execute(sql`
    SELECT COUNT(*)::int as total
    FROM zonga_media_variants
    WHERE status = 'ready'
  `)
  const variant = (variantRows as unknown as Array<Record<string, unknown>>)[0]

  return {
    totalStreams: (stream?.total as number) ?? 0,
    activeStreams: (stream?.active as number) ?? 0,
    totalMediaJobs: (job?.total as number) ?? 0,
    completedJobs: (job?.completed as number) ?? 0,
    failedJobs: (job?.failed as number) ?? 0,
    totalVariants: (variant?.total as number) ?? 0,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function inferQualityTier(key: string): QualityTier {
  if (key.includes('/hifi/') || key.includes('_hifi')) return 'hifi'
  if (key.includes('/high/') || key.includes('_high')) return 'high'
  if (key.includes('/preview/') || key.includes('_preview')) return 'preview'
  return 'standard'
}

function inferFormat(key: string): string {
  if (key.endsWith('.m3u8')) return 'hls'
  if (key.endsWith('.mp4')) return 'mp4'
  if (key.endsWith('.webm')) return 'webm'
  if (key.endsWith('.flac')) return 'flac'
  if (key.endsWith('.aac')) return 'aac'
  return 'unknown'
}

function mapJobRow(row: Record<string, unknown>): MediaJob {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    contentAssetId: row.content_asset_id as string,
    provider: row.provider as string,
    providerJobId: row.provider_job_id as string | null,
    jobType: row.job_type as MediaJobType,
    status: row.status as MediaJobStatus,
    submittedAt: row.submitted_at as string | null,
    completedAt: row.completed_at as string | null,
    errorSummary: row.error_summary as string | null,
    metadataJson: (row.metadata_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function mapVariantRow(row: Record<string, unknown>): MediaVariant {
  return {
    id: row.id as string,
    contentAssetId: row.content_asset_id as string,
    provider: row.provider as string,
    storageKey: row.storage_key as string,
    deliveryUrlRef: row.delivery_url_ref as string | null,
    qualityTier: row.quality_tier as QualityTier,
    bitrate: row.bitrate as number | null,
    codec: row.codec as string | null,
    format: row.format as string | null,
    durationSeconds: row.duration_seconds as number | null,
    status: row.status as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}
