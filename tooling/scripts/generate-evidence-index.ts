#!/usr/bin/env npx tsx
/**
 * generate-evidence-index.ts
 *
 * Generates an Evidence Pack Index JSON file conforming to
 * ops/compliance/Evidence-Pack-Index.schema.json.
 *
 * Modes:
 *   LOCAL (default) — Builds the index JSON from local files and writes to --out or stdout.
 *   UPLOAD (--upload) — Uploads each artifact to Azure Blob via @nzila/blob,
 *                       creates documents + audit_events + evidence_packs +
 *                       evidence_pack_artifacts rows via @nzila/db,
 *                       then uploads the index JSON itself.
 *
 * Usage (local):
 *   npx tsx tooling/scripts/generate-evidence-index.ts \
 *     --pack-id IR-2026-001 \
 *     --entity-id acme-holdings \
 *     --control-family incident-response \
 *     --event-type incident \
 *     --event-id IR-2026-001 \
 *     --container evidence \
 *     --base-path "acme-holdings/incident-response/2026/01/postmortem/IR-2026-001" \
 *     --created-by user_abc123 \
 *     --retention-class 7_YEARS \
 *     --summary "Evidence pack for incident IR-2026-001" \
 *     --controls IR-01,IR-02,IR-03 \
 *     --artifacts ./tmp/evidence-artifacts/ \
 *     --out ./tmp/evidence-pack-index.json
 *
 * Usage (upload):
 *   npx tsx tooling/scripts/generate-evidence-index.ts \
 *     --upload \
 *     --pack-id IR-2026-001 \
 *     --entity-id <uuid> \
 *     --control-family incident-response \
 *     --event-type incident \
 *     --event-id IR-2026-001 \
 *     --created-by user_abc123 \
 *     --artifacts ./tmp/evidence-artifacts/
 *
 * Artifacts can be provided as:
 *   --artifacts <directory>     Reads all files in the directory
 *   --artifacts <file1> <file2> Individual files (repeat flag or space-separated)
 *
 * Environment variables:
 *   DATABASE_URL                  Required for --upload
 *   AZURE_STORAGE_ACCOUNT_NAME    Required for --upload
 *   AZURE_STORAGE_ACCOUNT_KEY     Required for --upload
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { basename, extname, join, resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'

// ── Types ───────────────────────────────────────────────────────────────────

type ControlFamily =
  | 'access'
  | 'change-mgmt'
  | 'incident-response'
  | 'dr-bcp'
  | 'integrity'
  | 'sdlc'
  | 'retention'

type EventType =
  | 'incident'
  | 'dr-test'
  | 'access-review'
  | 'period-close'
  | 'release'
  | 'restore-test'
  | 'control-test'
  | 'audit-request'

type RetentionClass = 'PERMANENT' | '7_YEARS' | '3_YEARS' | '1_YEAR'
type Classification = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
type BlobContainer = 'evidence' | 'minutebook' | 'exports'

interface Artifact {
  artifact_id: string
  artifact_type: string
  filename: string
  blob_path: string
  sha256: string
  content_type: string
  size_bytes: number
  created_at: string
  created_by: string
  retention_class: RetentionClass
  classification?: Classification
  description?: string
}

interface EvidencePackIndex {
  schema_version: '1.0.0'
  pack_id: string
  entity_id: string
  control_family: ControlFamily
  event_type: EventType
  event_id: string
  created_at: string
  created_by: string
  run_id: string
  blob_container: BlobContainer
  base_path: string
  summary: string
  controls_covered: string[]
  artifacts: Artifact[]
  verification: {
    all_hashes_verified: boolean
    chain_integrity?: 'VERIFIED' | 'UNVERIFIED' | 'BROKEN'
    verified_at?: string
    verified_by?: string
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeSha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

const MIME_MAP: Record<string, string> = {
  '.json': 'application/json',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.zip': 'application/zip',
}

function guessContentType(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

/** Derive artifact_type from filename: "postmortem.pdf" → "postmortem" */
function deriveArtifactType(filename: string): string {
  const name = basename(filename, extname(filename))
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

// ── Collect artifact files ──────────────────────────────────────────────────

function collectFiles(paths: string[]): string[] {
  const files: string[] = []
  for (const p of paths) {
    const resolved = resolve(p)
    const stat = statSync(resolved)
    if (stat.isDirectory()) {
      for (const entry of readdirSync(resolved)) {
        const child = join(resolved, entry)
        if (statSync(child).isFile()) {
          files.push(child)
        }
      }
    } else if (stat.isFile()) {
      files.push(resolved)
    }
  }
  return files
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const VALID_CONTROL_FAMILIES = new Set<ControlFamily>([
  'access',
  'change-mgmt',
  'incident-response',
  'dr-bcp',
  'integrity',
  'sdlc',
  'retention',
])

const VALID_EVENT_TYPES = new Set<EventType>([
  'incident',
  'dr-test',
  'access-review',
  'period-close',
  'release',
  'restore-test',
  'control-test',
  'audit-request',
])

const VALID_RETENTION_CLASSES = new Set<RetentionClass>([
  'PERMANENT',
  '7_YEARS',
  '3_YEARS',
  '1_YEAR',
])

const VALID_CONTAINERS = new Set<BlobContainer>(['evidence', 'minutebook', 'exports'])

function fatal(msg: string): never {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      'pack-id': { type: 'string' },
      'entity-id': { type: 'string' },
      'control-family': { type: 'string' },
      'event-type': { type: 'string' },
      'event-id': { type: 'string' },
      container: { type: 'string', default: 'evidence' },
      'base-path': { type: 'string' },
      'created-by': { type: 'string' },
      'retention-class': { type: 'string', default: '7_YEARS' },
      classification: { type: 'string', default: 'INTERNAL' },
      summary: { type: 'string', default: '' },
      controls: { type: 'string', default: '' },
      artifacts: { type: 'string', multiple: true },
      out: { type: 'string' },
      upload: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: true,
  })

  if (values.help) {
    console.log(`
Usage: npx tsx tooling/scripts/generate-evidence-index.ts [options]

Required:
  --pack-id          Unique pack identifier (e.g., IR-2026-001)
  --entity-id        Entity slug (e.g., acme-holdings)
  --control-family   One of: access, change-mgmt, incident-response, dr-bcp, integrity, sdlc, retention
  --event-type       One of: incident, dr-test, access-review, period-close, release, restore-test, control-test, audit-request
  --event-id         Event identifier
  --base-path        Blob path prefix for artifacts
  --created-by       Clerk user ID or system identifier
  --artifacts        Directory or file(s) to include (repeatable)

Optional:
  --container        Blob container (default: evidence)
  --retention-class  Retention class (default: 7_YEARS)
  --classification   Data classification (default: INTERNAL)
  --summary          Human-readable summary
  --controls         Comma-separated control IDs (e.g., IR-01,IR-02)
  --out              Output file path (default: stdout)
  --upload           Upload artifacts to Azure Blob + create DB rows (requires DATABASE_URL, AZURE_STORAGE_*)
  --help             Show this help
`)
    process.exit(0)
  }

  // Validate required args
  const packId = values['pack-id'] ?? fatal('--pack-id is required')
  const entityId = values['entity-id'] ?? fatal('--entity-id is required')
  const controlFamily = values['control-family'] ?? fatal('--control-family is required')
  const eventType = values['event-type'] ?? fatal('--event-type is required')
  const eventId = values['event-id'] ?? fatal('--event-id is required')
  const basePath = values['base-path'] ?? fatal('--base-path is required')
  const createdBy = values['created-by'] ?? fatal('--created-by is required')
  const artifactPaths = values.artifacts ?? []

  if (!VALID_CONTROL_FAMILIES.has(controlFamily as ControlFamily)) {
    fatal(`Invalid --control-family "${controlFamily}". Must be one of: ${[...VALID_CONTROL_FAMILIES].join(', ')}`)
  }
  if (!VALID_EVENT_TYPES.has(eventType as EventType)) {
    fatal(`Invalid --event-type "${eventType}". Must be one of: ${[...VALID_EVENT_TYPES].join(', ')}`)
  }

  const retentionClass = values['retention-class'] as string
  if (!VALID_RETENTION_CLASSES.has(retentionClass as RetentionClass)) {
    fatal(`Invalid --retention-class "${retentionClass}". Must be one of: ${[...VALID_RETENTION_CLASSES].join(', ')}`)
  }

  const containerName = values.container as string
  if (!VALID_CONTAINERS.has(containerName as BlobContainer)) {
    fatal(`Invalid --container "${containerName}". Must be one of: ${[...VALID_CONTAINERS].join(', ')}`)
  }

  // Also accept positional args as artifact paths
  const allArtifactPaths = [...artifactPaths, ...positionals]
  if (allArtifactPaths.length === 0) {
    fatal('No artifacts provided. Use --artifacts <dir|file> or positional args.')
  }

  // Collect files
  const files = collectFiles(allArtifactPaths)
  if (files.length === 0) {
    fatal('No files found in the provided artifact paths.')
  }

  const classification = (values.classification as Classification) ?? 'INTERNAL'
  const controls = values.controls
    ? (values.controls as string).split(',').map((c) => c.trim()).filter(Boolean)
    : []

  const now = new Date().toISOString()
  const runId = randomUUID()
  const doUpload = values.upload as boolean

  // Build artifacts array (with raw data for upload)
  const artifactsWithData = files.map((filePath) => {
    const data = readFileSync(filePath)
    const filename = basename(filePath)
    const sha256 = computeSha256(data)
    const artifactType = deriveArtifactType(filename)
    const artifactId = `${packId}-${artifactType}`
    const blobPath = `${basePath}/${filename}`

    return {
      artifact_id: artifactId,
      artifact_type: artifactType,
      filename,
      blob_path: blobPath,
      sha256,
      content_type: guessContentType(filename),
      size_bytes: data.length,
      created_at: now,
      created_by: createdBy,
      retention_class: retentionClass as RetentionClass,
      classification: classification as Classification,
      _buffer: data, // internal — not serialised to JSON
    }
  })

  // Strip buffers for JSON serialisation
  const artifacts: Artifact[] = artifactsWithData.map(({ _buffer, ...rest }) => rest)

  // Build the index
  const index: EvidencePackIndex = {
    schema_version: '1.0.0',
    pack_id: packId,
    entity_id: entityId,
    control_family: controlFamily as ControlFamily,
    event_type: eventType as EventType,
    event_id: eventId,
    created_at: now,
    created_by: createdBy,
    run_id: runId,
    blob_container: containerName as BlobContainer,
    base_path: basePath,
    summary: (values.summary as string) || `Evidence pack ${packId} for ${eventType} ${eventId}`,
    controls_covered: controls,
    artifacts,
    verification: {
      all_hashes_verified: true,
      chain_integrity: 'UNVERIFIED',
      verified_at: now,
      verified_by: 'generate-evidence-index.ts',
    },
  }

  // ── Upload mode ───────────────────────────────────────────────────────
  if (doUpload) {
    await runUpload(index, artifactsWithData, {
      entityId,
      packId,
      controlFamily: controlFamily as ControlFamily,
      eventType: eventType as EventType,
      eventId,
      basePath,
      containerName: containerName as BlobContainer,
      retentionClass: retentionClass as RetentionClass,
      classification: classification as Classification,
      controls,
      createdBy,
      runId,
      now,
    })
    return
  }

  // ── Local-only mode ───────────────────────────────────────────────────
  const json = JSON.stringify(index, null, 2)
  const outPath = values.out as string | undefined
  if (outPath) {
    const outDir = dirname(resolve(outPath))
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true })
    }
    writeFileSync(resolve(outPath), json, 'utf-8')
    console.error(`✔ Evidence pack index written to ${resolve(outPath)}`)
    console.error(`  Pack ID:    ${packId}`)
    console.error(`  Artifacts:  ${artifacts.length}`)
    console.error(`  Run ID:     ${runId}`)
  } else {
    process.stdout.write(json + '\n')
  }
}

// ── Upload pipeline ─────────────────────────────────────────────────────────

interface UploadContext {
  entityId: string
  packId: string
  controlFamily: ControlFamily
  eventType: EventType
  eventId: string
  basePath: string
  containerName: BlobContainer
  retentionClass: RetentionClass
  classification: Classification
  controls: string[]
  createdBy: string
  runId: string
  now: string
}

type ArtifactWithBuffer = Artifact & { _buffer: Buffer }

async function runUpload(
  index: EvidencePackIndex,
  artifactsWithData: ArtifactWithBuffer[],
  ctx: UploadContext,
): Promise<void> {
  // Dynamic imports — only loaded in upload mode so the script
  // works locally without DB/Blob env vars.
  const { uploadBuffer } = await import('@nzila/blob')
  const { db } = await import('@nzila/db')
  const {
    documents,
    auditEvents,
    evidencePacks,
    evidencePackArtifacts,
  } = await import('@nzila/db/schema')
  const { computeEntryHash } = await import('@nzila/os-core/hash')

  console.error(`⬆ Uploading ${artifactsWithData.length} artifacts to ${ctx.containerName}/${ctx.basePath}...`)

  const documentIds: string[] = []
  const auditEventIds: string[] = []

  // 1. Upload each artifact → create documents row + audit_events row
  for (const art of artifactsWithData) {
    // Upload to Azure Blob
    const uploadResult = await uploadBuffer({
      container: ctx.containerName,
      blobPath: art.blob_path,
      buffer: art._buffer,
      contentType: art.content_type,
    })

    console.error(`  ✔ ${art.filename} → ${uploadResult.blobPath} (${uploadResult.sizeBytes} bytes)`)

    // Insert documents row
    const [docRow] = await db
      .insert(documents)
      .values({
        entityId: ctx.entityId,
        category: 'other',
        title: `${ctx.packId} — ${art.artifact_type}`,
        blobContainer: ctx.containerName,
        blobPath: uploadResult.blobPath,
        contentType: art.content_type,
        sizeBytes: BigInt(uploadResult.sizeBytes),
        sha256: uploadResult.sha256,
        uploadedBy: ctx.createdBy,
        classification: 'internal',
        linkedType: 'governance_action',
        linkedId: ctx.eventId,
      })
      .returning({ id: documents.id })

    documentIds.push(docRow.id)

    // Insert audit_events row
    const auditPayload = {
      action: 'evidence.artifact.uploaded',
      packId: ctx.packId,
      artifactId: art.artifact_id,
      blobPath: uploadResult.blobPath,
      sha256: uploadResult.sha256,
      sizeBytes: uploadResult.sizeBytes,
    }
    const hash = computeEntryHash(auditPayload, null)

    const [auditRow] = await db
      .insert(auditEvents)
      .values({
        entityId: ctx.entityId,
        actorId: ctx.createdBy,
        action: 'evidence.artifact.uploaded',
        resourceType: 'document',
        resourceId: docRow.id,
        detail: auditPayload,
        hash,
        previousHash: null,
      })
      .returning({ id: auditEvents.id })

    auditEventIds.push(auditRow.id)
  }

  // 2. Upload the index JSON itself
  const indexBuffer = Buffer.from(JSON.stringify(index, null, 2))
  const indexBlobPath = `${ctx.basePath}/evidence-pack-index.json`

  const indexUpload = await uploadBuffer({
    container: ctx.containerName,
    blobPath: indexBlobPath,
    buffer: indexBuffer,
    contentType: 'application/json',
  })

  const [indexDocRow] = await db
    .insert(documents)
    .values({
      entityId: ctx.entityId,
      category: 'other',
      title: `${ctx.packId} — Evidence Pack Index`,
      blobContainer: ctx.containerName,
      blobPath: indexUpload.blobPath,
      contentType: 'application/json',
      sizeBytes: BigInt(indexUpload.sizeBytes),
      sha256: indexUpload.sha256,
      uploadedBy: ctx.createdBy,
      classification: 'internal',
      linkedType: 'governance_action',
      linkedId: ctx.eventId,
    })
    .returning({ id: documents.id })

  console.error(`  ✔ evidence-pack-index.json → ${indexUpload.blobPath}`)

  // 3. Create evidence_packs row
  const [packRow] = await db
    .insert(evidencePacks)
    .values({
      packId: ctx.packId,
      entityId: ctx.entityId,
      controlFamily: ctx.controlFamily,
      eventType: ctx.eventType,
      eventId: ctx.eventId,
      runId: ctx.runId,
      blobContainer: ctx.containerName,
      basePath: ctx.basePath,
      summary: index.summary,
      controlsCovered: ctx.controls,
      artifactCount: artifactsWithData.length,
      allHashesVerified: true,
      chainIntegrity: 'UNVERIFIED',
      status: 'sealed',
      indexDocumentId: indexDocRow.id,
      createdBy: ctx.createdBy,
    })
    .returning({ id: evidencePacks.id })

  // 4. Create evidence_pack_artifacts join rows
  for (let i = 0; i < artifactsWithData.length; i++) {
    const art = artifactsWithData[i]
    await db.insert(evidencePackArtifacts).values({
      packId: packRow.id,
      documentId: documentIds[i],
      artifactId: art.artifact_id,
      artifactType: art.artifact_type,
      retentionClass: ctx.retentionClass,
      auditEventId: auditEventIds[i],
    })
  }

  // 5. Create final audit event for the sealed pack
  const sealPayload = {
    action: 'evidence.pack.sealed',
    packId: ctx.packId,
    evidencePackDbId: packRow.id,
    artifactCount: artifactsWithData.length,
    runId: ctx.runId,
  }
  const sealHash = computeEntryHash(sealPayload, null)
  await db.insert(auditEvents).values({
    entityId: ctx.entityId,
    actorId: ctx.createdBy,
    action: 'evidence.pack.sealed',
    resourceType: 'evidence_pack',
    resourceId: packRow.id,
    detail: sealPayload,
    hash: sealHash,
    previousHash: null,
  })

  console.error('')
  console.error(`✔ Evidence pack uploaded and sealed.`)
  console.error(`  Pack ID:            ${ctx.packId}`)
  console.error(`  DB evidence_pack:   ${packRow.id}`)
  console.error(`  Artifacts uploaded:  ${artifactsWithData.length}`)
  console.error(`  Documents created:   ${documentIds.length + 1}`)
  console.error(`  Audit events:        ${auditEventIds.length + 1}`)
  console.error(`  Run ID:             ${ctx.runId}`)
  console.error(`  Index blob:         ${indexBlobPath}`)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

