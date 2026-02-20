/**
 * Nzila OS — generate-evidence-index
 *
 * CLI job that takes an evidence pack request, uploads all artifacts
 * to Azure Blob Storage, records document metadata in the DB,
 * generates an Evidence-Pack-Index.json, and seals the pack.
 *
 * Usage:
 *   npx tsx packages/os-core/src/evidence/generate-evidence-index.ts \
 *     --pack-request ./pack-request.json
 *
 *   Or import and call programmatically:
 *     import { processEvidencePack } from '@nzila/os-core/evidence/generate-evidence-index'
 *
 * This is the "last mile" that connects:
 *   - buildEvidencePackFromAction() → evidence pack request
 *   - @nzila/blob → Azure Blob upload
 *   - @nzila/db → document + evidence_packs + evidence_pack_artifacts rows
 *   - audit_events → hash-chained record of every artifact upload
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { uploadBuffer, computeSha256 } from '@nzila/blob'
import { db } from '@nzila/db'
import {
  documents,
  evidencePacks,
  evidencePackArtifacts,
  auditEvents,
} from '@nzila/db/schema'
import { computeEntryHash } from '../hash'
import { eq, desc } from 'drizzle-orm'
import type {
  EvidencePackRequest,
  EvidencePackResult,
  UploadedArtifact,
} from './types'

// ── Core: process an evidence pack ──────────────────────────────────────────

export interface ProcessEvidencePackOptions {
  /** If true, skip the actual Blob upload (for testing / dry-run) */
  dryRun?: boolean
  /** Override the run ID (for idempotent retries) */
  runId?: string
  /** Override the auto-computed blob base path */
  basePath?: string
  /** Period label for appendix collectors, e.g. '2026-02' */
  periodLabel?: string
}

/** Local-only (no upload) representation of an evidence pack index. */
export interface LocalEvidencePackIndex {
  $schema: string
  packId: string
  runId: string
  entityId: string
  controlFamily: string
  eventType: string
  eventId: string
  summary: string
  controlsCovered: string[]
  createdBy: string
  createdAt: string
  basePath: string
  artifacts: Array<{
    artifactId: string
    artifactType: string
    filename: string
    blobPath: string
    sha256: string
    contentType: string
    sizeBytes: number
    retentionClass: string
    classification: string
  }>
}

/**
 * Build a local (no-upload) evidence pack index JSON.
 * No DB/Blob dependencies. Useful for the CLI local mode and testing.
 */
export function buildLocalEvidencePackIndex(
  request: EvidencePackRequest,
  opts: { basePath?: string; periodLabel?: string; runId?: string } = {},
): LocalEvidencePackIndex {
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const runId = opts.runId ?? randomUUID()
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const basePath =
    opts.basePath ??
    `${request.entityId}/${request.controlFamily}/${year}/${month}/${request.packId}`

  const artifacts = request.artifacts.map((artifact) => {
    const sha256 = createHash('sha256').update(artifact.buffer).digest('hex')
    const blobPath = `${basePath}/${artifact.filename}`
    return {
      artifactId: artifact.artifactId,
      artifactType: artifact.artifactType,
      filename: artifact.filename,
      blobPath,
      sha256,
      contentType: artifact.contentType,
      sizeBytes: artifact.buffer.length,
      retentionClass: artifact.retentionClass,
      classification: artifact.classification ?? 'INTERNAL',
    }
  })

  return {
    $schema: 'Evidence-Pack-Index.schema.json',
    packId: request.packId,
    runId,
    entityId: request.entityId,
    controlFamily: request.controlFamily,
    eventType: request.eventType,
    eventId: request.eventId,
    summary: request.summary ?? '',
    controlsCovered: request.controlsCovered,
    createdBy: request.createdBy,
    createdAt: now.toISOString(),
    basePath,
    artifacts,
  }
}



/**
 * Process a complete evidence pack:
 *
 * 1. Upload each artifact to Azure Blob
 * 2. Record each artifact in the `documents` table
 * 3. Record audit events for each upload
 * 4. Generate Evidence-Pack-Index.json and upload it
 * 5. Create `evidence_packs` + `evidence_pack_artifacts` rows
 * 6. Return the complete result
 */
export async function processEvidencePack(
  request: EvidencePackRequest,
  opts: ProcessEvidencePackOptions = {},
): Promise<EvidencePackResult> {
  const runId = opts.runId ?? randomUUID()
  const blobContainer = request.blobContainer ?? 'evidence'
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const basePath =
    opts.basePath ??
    `${request.entityId}/${request.controlFamily}/${year}/${month}/${request.packId}`

  console.log(`[evidence-index] Processing pack ${request.packId} (run ${runId})`)
  console.log(`[evidence-index]   entity: ${request.entityId}`)
  console.log(`[evidence-index]   control family: ${request.controlFamily}`)
  console.log(`[evidence-index]   artifacts: ${request.artifacts.length}`)

  const uploadedArtifacts: UploadedArtifact[] = []

  // ── Upload each artifact ────────────────────────────────────────────────

  for (const artifact of request.artifacts) {
    const blobPath = `${basePath}/${artifact.filename}`
    const sha256 = computeSha256(artifact.buffer)

    console.log(`[evidence-index]   uploading ${artifact.artifactId} → ${blobPath}`)

    if (!opts.dryRun) {
      // 1. Upload to Blob
      await uploadBuffer({
        container: blobContainer,
        blobPath,
        buffer: artifact.buffer,
        contentType: artifact.contentType,
      })

      // 2. Record in documents table
      const [doc] = await db
        .insert(documents)
        .values({
          entityId: request.entityId,
          category: 'other', // could be refined based on artifactType
          title: `${request.packId} — ${artifact.artifactType}`,
          blobContainer,
          blobPath,
          contentType: artifact.contentType,
          sizeBytes: BigInt(artifact.buffer.length),
          sha256,
          uploadedBy: request.createdBy,
          classification: artifact.classification?.toLowerCase() as
            | 'public'
            | 'internal'
            | 'confidential' ?? 'internal',
          linkedType: 'evidence_pack',
          linkedId: undefined, // will be set after pack row is created
        })
        .returning({ id: documents.id })

      // 3. Record audit event for upload
      const [latestAudit] = await db
        .select({ hash: auditEvents.hash })
        .from(auditEvents)
        .where(eq(auditEvents.entityId, request.entityId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(1)

      const previousHash = latestAudit?.hash ?? null
      const auditPayload = {
        entityId: request.entityId,
        actorClerkUserId: request.createdBy,
        action: 'document.upload',
        targetType: 'document',
        targetId: doc.id,
        afterJson: { blobPath, sha256, packId: request.packId },
        timestamp: new Date().toISOString(),
      }
      const hash = computeEntryHash(auditPayload, previousHash)

      const [auditRow] = await db
        .insert(auditEvents)
        .values({
          entityId: request.entityId,
          actorClerkUserId: request.createdBy,
          action: 'document.upload',
          targetType: 'document',
          targetId: doc.id,
          afterJson: { blobPath, sha256, packId: request.packId },
          hash,
          previousHash,
        })
        .returning({ id: auditEvents.id })

      uploadedArtifacts.push({
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType,
        filename: artifact.filename,
        blobPath,
        sha256,
        contentType: artifact.contentType,
        sizeBytes: artifact.buffer.length,
        retentionClass: artifact.retentionClass,
        classification: artifact.classification ?? 'INTERNAL',
        documentId: doc.id,
        auditEventId: auditRow.id,
      })
    } else {
      // Dry run — produce results without DB/Blob writes
      uploadedArtifacts.push({
        artifactId: artifact.artifactId,
        artifactType: artifact.artifactType,
        filename: artifact.filename,
        blobPath,
        sha256,
        contentType: artifact.contentType,
        sizeBytes: artifact.buffer.length,
        retentionClass: artifact.retentionClass,
        classification: artifact.classification ?? 'INTERNAL',
        documentId: `dry-run-${randomUUID()}`,
        auditEventId: `dry-run-${randomUUID()}`,
      })
    }
  }

  // ── Generate Evidence-Pack-Index.json ─────────────────────────────────────

  const indexPayload = {
    $schema: 'Evidence-Pack-Index.schema.json',
    packId: request.packId,
    runId,
    entityId: request.entityId,
    controlFamily: request.controlFamily,
    eventType: request.eventType,
    eventId: request.eventId,
    summary: request.summary,
    controlsCovered: request.controlsCovered,
    createdBy: request.createdBy,
    createdAt: now.toISOString(),
    artifacts: uploadedArtifacts.map((a) => ({
      artifactId: a.artifactId,
      artifactType: a.artifactType,
      filename: a.filename,
      blobPath: a.blobPath,
      sha256: a.sha256,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
      retentionClass: a.retentionClass,
      classification: a.classification,
    })),
  }

  const indexBuffer = Buffer.from(JSON.stringify(indexPayload, null, 2))
  const indexBlobPath = `${basePath}/evidence-pack-index.json`
  const indexSha256 = computeSha256(indexBuffer)

  let indexDocumentId = `dry-run-${randomUUID()}`
  let evidencePackDbId = `dry-run-${randomUUID()}`

  if (!opts.dryRun) {
    // Upload index file
    await uploadBuffer({
      container: blobContainer,
      blobPath: indexBlobPath,
      buffer: indexBuffer,
      contentType: 'application/json',
    })

    // Record index document
    const [indexDoc] = await db
      .insert(documents)
      .values({
        entityId: request.entityId,
        category: 'other',
        title: `${request.packId} — Evidence Pack Index`,
        blobContainer,
        blobPath: indexBlobPath,
        contentType: 'application/json',
        sizeBytes: BigInt(indexBuffer.length),
        sha256: indexSha256,
        uploadedBy: request.createdBy,
        classification: 'internal',
        linkedType: 'evidence_pack',
      })
      .returning({ id: documents.id })

    indexDocumentId = indexDoc.id

    // ── Create evidence_packs row ───────────────────────────────────────────

    const [pack] = await db
      .insert(evidencePacks)
      .values({
        packId: request.packId,
        entityId: request.entityId,
        controlFamily: request.controlFamily,
        eventType: request.eventType,
        eventId: request.eventId,
        runId,
        blobContainer,
        basePath,
        summary: request.summary ?? '',
        controlsCovered: request.controlsCovered,
        artifactCount: uploadedArtifacts.length,
        status: 'sealed',
        indexDocumentId,
        createdBy: request.createdBy,
      })
      .returning({ id: evidencePacks.id })

    evidencePackDbId = pack.id

    // ── Create evidence_pack_artifacts join rows ────────────────────────────

    for (const a of uploadedArtifacts) {
      await db.insert(evidencePackArtifacts).values({
        packId: pack.id,
        documentId: a.documentId,
        artifactId: a.artifactId,
        artifactType: a.artifactType,
        retentionClass: a.retentionClass,
        auditEventId: a.auditEventId,
      })
    }

    // Back-link documents to the evidence pack
    for (const a of uploadedArtifacts) {
      await db
        .update(documents)
        .set({ linkedId: pack.id })
        .where(eq(documents.id, a.documentId))
    }
    await db
      .update(documents)
      .set({ linkedId: pack.id })
      .where(eq(documents.id, indexDocumentId))
  }

  console.log(`[evidence-index] Pack ${request.packId} sealed`)
  console.log(`[evidence-index]   artifacts: ${uploadedArtifacts.length}`)
  console.log(`[evidence-index]   index: ${indexBlobPath}`)
  console.log(`[evidence-index]   db id: ${evidencePackDbId}`)

  return {
    packId: request.packId,
    runId,
    entityId: request.entityId,
    controlFamily: request.controlFamily,
    eventType: request.eventType,
    eventId: request.eventId,
    blobContainer,
    basePath,
    summary: request.summary ?? '',
    controlsCovered: request.controlsCovered,
    artifacts: uploadedArtifacts,
    indexBlobPath,
    indexDocumentId,
    evidencePackDbId,
    createdAt: now.toISOString(),
  }
}

// ── CLI entry point ─────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const requestIdx = args.indexOf('--pack-request')
  const dryRunFlag = args.includes('--dry-run')

  if (requestIdx === -1 || !args[requestIdx + 1]) {
    console.error('Usage: generate-evidence-index --pack-request <file.json> [--dry-run]')
    process.exit(1)
  }

  const requestPath = args[requestIdx + 1]
  const raw = readFileSync(requestPath, 'utf-8')
  const request = JSON.parse(raw) as EvidencePackRequest

  // Reconstruct Buffers from base64 strings (JSON serialization)
  for (const artifact of request.artifacts) {
    if (typeof artifact.buffer === 'string') {
      artifact.buffer = Buffer.from(artifact.buffer as unknown as string, 'base64')
    }
  }

  const result = await processEvidencePack(request, { dryRun: dryRunFlag })

  console.log('\n── Result ──')
  console.log(JSON.stringify(result, null, 2))

  process.exit(0)
}

// Run if executed directly
const isDirectRun = process.argv[1]?.includes('generate-evidence-index')
if (isDirectRun) {
  main().catch((err) => {
    console.error('[evidence-index] Fatal error:', err)
    process.exit(1)
  })
}
