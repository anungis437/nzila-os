/**
 * @nzila/media-worker — Failure Recovery
 *
 * Retry classification, partial artifact cleanup,
 * and orphan detection for failed transcode jobs.
 *
 * @module @nzila/media-worker/recovery
 */

import type { StorageProvider } from './storage'
import { processedPath, hlsPath, waveformPath, previewPath } from './storage'
import { isRetryableError, type StructuredLogger, MEDIA_METRICS } from './observability'

// ── Retry Classification ────────────────────────────────────────────────────

export type RetryDecision =
  | { action: 'retry'; delayMs: number }
  | { action: 'dead-letter'; reason: string }

/**
 * Determines whether a failed job should be retried or dead-lettered.
 * Uses exponential backoff with jitter for retryable errors.
 */
export function classifyFailure(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): RetryDecision {
  if (attempt >= maxAttempts) {
    return {
      action: 'dead-letter',
      reason: `Max attempts (${maxAttempts}) exhausted`,
    }
  }

  if (!isRetryableError(error)) {
    return {
      action: 'dead-letter',
      reason: `Non-retryable error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  // Exponential backoff: 1s, 2s, 4s, 8s... with ±25% jitter
  const baseDelay = Math.pow(2, attempt) * 1000
  const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1)
  const delayMs = Math.round(Math.max(1000, baseDelay + jitter))

  return { action: 'retry', delayMs }
}

// ── Partial Artifact Cleanup ────────────────────────────────────────────────

/**
 * Cleans up any partial artifacts from a failed transcode job.
 * Removes processed files, HLS segments, waveform, and preview.
 * Best-effort — logs but does not throw on cleanup failures.
 */
export async function cleanupPartialArtifacts(
  storage: StorageProvider,
  assetId: string,
  logger: StructuredLogger,
): Promise<{ cleaned: number; errors: number }> {
  const prefixes = [
    processedPath(assetId, ''),   // audio/processed/{assetId}/
    hlsPath(assetId),             // audio/hls/{assetId}
    waveformPath(assetId),        // audio/waveform/{assetId}.json
    previewPath(assetId),         // audio/preview/{assetId}.mp4
  ]

  let cleaned = 0
  let errors = 0

  for (const prefix of prefixes) {
    try {
      const objects = await storage.list(prefix)
      for (const obj of objects) {
        try {
          await storage.delete(obj.key)
          cleaned++
        } catch (err) {
          errors++
          logger.warn(`Failed to delete artifact: ${obj.key}`, {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } catch (err) {
      errors++
      logger.warn(`Failed to list artifacts under: ${prefix}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info(`Artifact cleanup for ${assetId}`, { cleaned, errors })
  return { cleaned, errors }
}

// ── Orphan Detection ────────────────────────────────────────────────────────

export interface OrphanedArtifact {
  readonly key: string
  readonly sizeBytes: number
  readonly lastModified: Date
}

/**
 * Scans storage for orphaned artifacts — files whose job is no longer
 * in the queue or database. Returns keys for manual review.
 *
 * @param knownAssetIds - Set of asset IDs that are still valid
 * @param prefix - Storage prefix to scan (e.g. 'audio/processed')
 */
export async function detectOrphans(
  storage: StorageProvider,
  prefix: string,
  knownAssetIds: ReadonlySet<string>,
  logger: StructuredLogger,
): Promise<readonly OrphanedArtifact[]> {
  const orphans: OrphanedArtifact[] = []

  try {
    const objects = await storage.list(prefix)

    for (const obj of objects) {
      // Extract asset ID from key: prefix/{assetId}/...
      const afterPrefix = obj.key.slice(prefix.length).replace(/^\//, '')
      const assetId = afterPrefix.split('/')[0]

      if (assetId && !knownAssetIds.has(assetId)) {
        orphans.push({
          key: obj.key,
          sizeBytes: obj.size,
          lastModified: obj.lastModified,
        })
      }
    }
  } catch (err) {
    logger.error('Orphan detection scan failed', err instanceof Error ? err : undefined, { prefix })
  }

  if (orphans.length > 0) {
    logger.info(`Detected ${orphans.length} orphaned artifacts`, {
      prefix,
      sampleKeys: orphans.slice(0, 5).map((o) => o.key),
    })
  }

  return orphans
}

/**
 * Removes a batch of orphaned artifacts. Returns count deleted.
 */
export async function purgeOrphans(
  storage: StorageProvider,
  orphans: readonly OrphanedArtifact[],
  logger: StructuredLogger,
): Promise<number> {
  let deleted = 0

  for (const orphan of orphans) {
    try {
      await storage.delete(orphan.key)
      deleted++
    } catch (err) {
      logger.warn(`Failed to purge orphan: ${orphan.key}`, {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info(`Purged ${deleted}/${orphans.length} orphaned artifacts`)
  return deleted
}
