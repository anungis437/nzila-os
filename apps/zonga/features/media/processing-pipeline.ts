/**
 * Zonga — Audio Processing Pipeline
 *
 * Manages the lifecycle of raw audio uploads through transcoding,
 * normalization, metadata extraction, and variant generation.
 *
 * Architecture: Queue-backed job processing.
 * Raw upload → validate → enqueue jobs → process → store variants → mark ready.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type {
  UploadJob,
  JobStatus,
  JobType,
  QualityTier,
} from './types'
import { PROCESSING_PROFILES } from './types'

// ── Job Queue Operations ────────────────────────────────────────────────────

/**
 * Enqueue all processing jobs for a newly uploaded track asset.
 * Creates transcode jobs for each quality tier + metadata extraction.
 */
export async function enqueueProcessingJobs(params: {
  trackAssetId: string
  orgId: string
  creatorId: string
  inputKey: string
}): Promise<string[]> {
  const { trackAssetId, orgId, creatorId, inputKey } = params
  const jobIds: string[] = []

  // Enqueue metadata extraction first (highest priority)
  const metaJob = await createJob({
    trackAssetId,
    orgId,
    creatorId,
    jobType: 'metadata_extract',
    inputKey,
    priority: 10,
  })
  jobIds.push(metaJob)

  // Enqueue fingerprint for duplicate detection
  const fpJob = await createJob({
    trackAssetId,
    orgId,
    creatorId,
    jobType: 'fingerprint',
    inputKey,
    priority: 9,
  })
  jobIds.push(fpJob)

  // Enqueue transcoding for each quality tier
  const tiers: QualityTier[] = ['preview', 'standard', 'high', 'hifi']
  for (const tier of tiers) {
    const profile = PROCESSING_PROFILES[tier]
    const outputKey = `processed/${creatorId}/${trackAssetId}/${tier}.${profile.format}`
    const job = await createJob({
      trackAssetId,
      orgId,
      creatorId,
      jobType: 'transcode',
      inputKey,
      outputKey,
      priority: tier === 'standard' ? 8 : 5,
    })
    jobIds.push(job)
  }

  // Enqueue waveform generation
  const waveJob = await createJob({
    trackAssetId,
    orgId,
    creatorId,
    jobType: 'waveform',
    inputKey,
    priority: 3,
  })
  jobIds.push(waveJob)

  logger.info('Processing jobs enqueued', {
    trackAssetId,
    jobCount: jobIds.length,
  })

  return jobIds
}

async function createJob(params: {
  trackAssetId: string
  orgId: string
  creatorId: string
  jobType: JobType
  inputKey: string
  outputKey?: string
  priority?: number
}): Promise<string> {
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_upload_jobs (
      track_asset_id, org_id, creator_id, job_type,
      input_key, output_key, priority, status
    ) VALUES (
      ${params.trackAssetId}, ${params.orgId}, ${params.creatorId},
      ${params.jobType}, ${params.inputKey}, ${params.outputKey ?? null},
      ${params.priority ?? 0}, 'queued'
    )
    RETURNING id
  `)
  const row = (rows as unknown as Array<{ id: string }>)[0]
  return row.id
}

// ── Job Processing ──────────────────────────────────────────────────────────

/**
 * Claim and process the next available job from the queue.
 * Uses SELECT FOR UPDATE SKIP LOCKED to prevent concurrent processing.
 */
export async function claimNextJob(): Promise<UploadJob | null> {
  const rows = await platformDb.execute(sql`
    UPDATE zonga_upload_jobs
    SET status = 'processing',
        started_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = (
      SELECT id FROM zonga_upload_jobs
      WHERE status IN ('queued', 'retrying')
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `)
  const row = (rows as unknown as Array<Record<string, unknown>>)[0]
  if (!row) return null

  return mapJobRow(row)
}

/**
 * Mark a job as completed with output location.
 */
export async function completeJob(
  jobId: string,
  outputKey?: string,
): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_upload_jobs
    SET status = 'completed',
        output_key = COALESCE(${outputKey ?? null}, output_key),
        completed_at = now(),
        updated_at = now()
    WHERE id = ${jobId}
  `)
}

/**
 * Mark a job as failed. If under max attempts, mark as retrying.
 */
export async function failJob(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  await platformDb.execute(sql`
    UPDATE zonga_upload_jobs
    SET status = CASE
          WHEN attempts < max_attempts THEN 'retrying'
          ELSE 'failed'
        END,
        error_message = ${errorMessage},
        updated_at = now()
    WHERE id = ${jobId}
  `)
}

/**
 * Register a processed variant after successful transcoding.
 */
export async function registerProcessedVariant(params: {
  trackAssetId: string
  qualityTier: QualityTier
  format: string
  bitrate: number
  codec: string
  storageKey: string
  fileSizeBytes: number
  durationSeconds?: number
  loudnessLufs?: number
}): Promise<string> {
  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_processed_variants (
      track_asset_id, quality_tier, format, bitrate, codec,
      storage_key, file_size_bytes, duration_seconds, loudness_lufs
    ) VALUES (
      ${params.trackAssetId}, ${params.qualityTier}, ${params.format},
      ${params.bitrate}, ${params.codec}, ${params.storageKey},
      ${params.fileSizeBytes}, ${params.durationSeconds ?? null},
      ${params.loudnessLufs ?? null}
    )
    RETURNING id
  `)
  const row = (rows as unknown as Array<{ id: string }>)[0]
  return row.id
}

/**
 * Check if all required processing jobs are complete for a track.
 */
export async function isProcessingComplete(trackAssetId: string): Promise<{
  complete: boolean
  totalJobs: number
  completedJobs: number
  failedJobs: number
}> {
  const rows = await platformDb.execute(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'completed')::int as completed,
      COUNT(*) FILTER (WHERE status = 'failed')::int as failed
    FROM zonga_upload_jobs
    WHERE track_asset_id = ${trackAssetId}
  `)
  const row = (rows as unknown as Array<{
    total: number
    completed: number
    failed: number
  }>)[0]

  return {
    complete: row.completed === row.total && row.total > 0,
    totalJobs: row.total,
    completedJobs: row.completed,
    failedJobs: row.failed,
  }
}

/**
 * Get failed jobs for operational monitoring.
 */
export async function getFailedJobs(opts?: {
  limit?: number
  orgId?: string
}): Promise<UploadJob[]> {
  const limit = opts?.limit ?? 50
  const orgFilter = opts?.orgId ? sql`AND org_id = ${opts.orgId}` : sql``

  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_upload_jobs
    WHERE status = 'failed'
    ${orgFilter}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map(mapJobRow)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapJobRow(row: Record<string, unknown>): UploadJob {
  return {
    id: row.id as string,
    trackAssetId: row.track_asset_id as string,
    orgId: row.org_id as string,
    creatorId: row.creator_id as string,
    jobType: row.job_type as JobType,
    status: row.status as JobStatus,
    priority: row.priority as number,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    errorMessage: row.error_message as string | undefined,
    inputKey: row.input_key as string,
    outputKey: row.output_key as string | undefined,
    startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  }
}
