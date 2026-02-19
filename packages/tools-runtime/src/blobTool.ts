/**
 * @nzila/tools-runtime — Blob Tool
 *
 * Thin wrapper around @nzila/blob for action engine usage.
 * Provides deterministic path building and upload with tool call logging.
 */
import { uploadBuffer, downloadBuffer, generateSasUrl, computeSha256 } from '@nzila/blob'
import { createToolCallEntry, type ToolCallEntry } from './sanitize'

const BLOB_CONTAINER = 'exports'

// ── Path builders ───────────────────────────────────────────────────────────

export function buildExportPath(parts: {
  entityId: string
  domain: string // e.g., "stripe", "ai"
  year: string
  month: string
  subPath: string // e.g., "revenue_summary/{artifactId}/report.json"
}): string {
  return `exports/${parts.entityId}/${parts.domain}/${parts.year}/${parts.month}/${parts.subPath}`
}

export function buildEvidencePath(parts: {
  entityId: string
  periodLabel: string
  subPath: string
}): string {
  return `evidence/${parts.entityId}/month/${parts.periodLabel}/${parts.subPath}`
}

export function buildAttestationPath(parts: {
  entityId: string
  year: string
  month: string
  actionType: string
  runId: string
}): string {
  const safeType = parts.actionType.replace(/\./g, '/')
  return `exports/${parts.entityId}/attestations/${parts.year}/${parts.month}/${safeType}/${parts.runId}/attestation.json`
}

// ── Upload ──────────────────────────────────────────────────────────────────

export interface BlobUploadResult {
  blobPath: string
  sha256: string
  sizeBytes: number
  toolCall: ToolCallEntry
}

/**
 * Upload a buffer to blob storage with tool call logging.
 */
export async function uploadWithLogging(opts: {
  container?: string
  blobPath: string
  buffer: Buffer
  contentType: string
}): Promise<BlobUploadResult> {
  const startedAt = new Date()
  try {
    const result = await uploadBuffer({
      container: opts.container ?? BLOB_CONTAINER,
      blobPath: opts.blobPath,
      buffer: opts.buffer,
      contentType: opts.contentType,
    })

    const finishedAt = new Date()
    const toolCall = createToolCallEntry({
      toolName: 'blobTool.upload',
      startedAt,
      finishedAt,
      inputs: { blobPath: opts.blobPath, sizeBytes: opts.buffer.length },
      outputs: { blobPath: result.blobPath, sha256: result.sha256 },
      status: 'success',
    })

    return { ...result, toolCall }
  } catch (err) {
    const finishedAt = new Date()
    const toolCall = createToolCallEntry({
      toolName: 'blobTool.upload',
      startedAt,
      finishedAt,
      inputs: { blobPath: opts.blobPath },
      outputs: {},
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
    throw Object.assign(err as Error, { toolCall })
  }
}

/**
 * Download a blob and return the buffer, with tool call logging.
 */
export async function downloadWithLogging(
  containerName: string,
  blobPath: string,
): Promise<{ buffer: Buffer; toolCall: ToolCallEntry }> {
  const startedAt = new Date()
  try {
    const buffer = await downloadBuffer(containerName, blobPath)
    const finishedAt = new Date()
    const toolCall = createToolCallEntry({
      toolName: 'blobTool.download',
      startedAt,
      finishedAt,
      inputs: { containerName, blobPath },
      outputs: { sizeBytes: buffer.length },
      status: 'success',
    })
    return { buffer, toolCall }
  } catch (err) {
    const finishedAt = new Date()
    const toolCall = createToolCallEntry({
      toolName: 'blobTool.download',
      startedAt,
      finishedAt,
      inputs: { containerName, blobPath },
      outputs: {},
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
    throw Object.assign(err as Error, { toolCall })
  }
}

export { generateSasUrl, computeSha256 }
