#!/usr/bin/env npx tsx
/**
 * generate-evidence-index.ts — THIN CLI WRAPPER
 *
 * ALL business logic lives in @nzila/os-core/evidence/generate-evidence-index.
 * This file is responsible ONLY for:
 *   1. Parsing CLI arguments
 *   2. Collecting artifact files from disk
 *   3. Building an EvidencePackRequest using os-core types
 *   4. Delegating to processEvidencePack() (upload) or
 *      buildLocalEvidencePackIndex() (local-only, no DB/Blob)
 *
 * !! DO NOT add schema building, type definitions, or DB/Blob pipeline
 *    logic here — add it to packages/os-core/src/evidence/ instead. !!
 *
 * Usage (local):
 *   npx tsx tooling/scripts/generate-evidence-index.ts \
 *     --pack-id IR-2026-001 --entity-id <uuid> \
 *     --control-family incident-response --event-type incident \
 *     --event-id IR-2026-001 --base-path <path> \
 *     --created-by user_abc123 --artifacts ./tmp/evidence-artifacts/
 *
 * Usage (upload):
 *   Add --upload flag. Requires DATABASE_URL + AZURE_STORAGE_ACCOUNT_NAME/KEY.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import type {
  ArtifactDescriptor,
  BlobContainer,
  RetentionClass,
  Classification,
  ControlFamily,
  EvidenceEventType,
  EvidencePackRequest,
} from '@nzila/os-core/evidence/types'

// Types are imported from @nzila/os-core — no local type definitions.
// See: packages/os-core/src/evidence/types.ts

// Artifact and EvidencePackIndex interfaces removed — use os-core types.

// ── File helpers (thin CLI layer only) ─────────────────────────────────────
// computeSha256 removed — hashing is done inside os-core processEvidencePack().

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

// Enum validation removed — Zod schemas in os-core enforce valid values.

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
      'include-ai-actions': { type: 'boolean', default: false },
      'include-ml': { type: 'boolean', default: false },
      'period-label': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
    strict: true,
  })

  if (values.help) {
    console.log(`
Nzila OS — Evidence Pack Generator (thin CLI wrapper → @nzila/os-core)

Usage: npx tsx tooling/scripts/generate-evidence-index.ts [options]

Required:  --pack-id, --entity-id, --control-family, --event-type,
           --event-id, --base-path, --created-by, --artifacts

Optional:  --container (default: evidence)
           --retention-class (default: 7_YEARS)
           --classification (default: INTERNAL)
           --summary, --controls (CSV), --out
           --upload  (requires DATABASE_URL + AZURE_STORAGE_*)
           --include-ai-actions, --include-ml, --period-label

All schema logic lives in packages/os-core/src/evidence/generate-evidence-index.ts.
`)
    process.exit(0)
  }

  // Parse CLI args — thin layer only
  const packId = values['pack-id'] ?? fatal('--pack-id is required')
  const entityId = values['entity-id'] ?? fatal('--entity-id is required')
  const controlFamily = (values['control-family'] ?? fatal('--control-family is required')) as ControlFamily
  const eventType = (values['event-type'] ?? fatal('--event-type is required')) as EvidenceEventType
  const eventId = values['event-id'] ?? fatal('--event-id is required')
  const basePath = values['base-path'] ?? fatal('--base-path is required')
  const createdBy = values['created-by'] ?? fatal('--created-by is required')

  const allArtifactPaths = [...(values.artifacts ?? []), ...positionals]
  if (allArtifactPaths.length === 0) {
    fatal('No artifacts provided. Use --artifacts <dir|file> or positional args.')
  }

  const files = collectFiles(allArtifactPaths)
  if (files.length === 0) fatal('No files found in the provided artifact paths.')

  const retentionClass = (values['retention-class'] ?? '7_YEARS') as RetentionClass
  const classification = (values.classification ?? 'INTERNAL') as Classification
  const blobContainer = (values.container ?? 'evidence') as BlobContainer
  const controls = values.controls
    ? (values.controls as string).split(',').map((c) => c.trim()).filter(Boolean)
    : []
  const summary = (values.summary as string) || `Evidence pack ${packId} for ${eventType} ${eventId}`
  const periodLabel = (values['period-label'] as string | undefined) ?? new Date().toISOString().slice(0, 7)

  // Build ArtifactDescriptor[] using os-core types — no schema logic here
  const artifacts: ArtifactDescriptor[] = files.map((filePath) => {
    const buffer = readFileSync(filePath)
    const filename = basename(filePath)
    const artifactType = basename(filename, extname(filename)).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    return {
      artifactId: `${packId}-${artifactType}`,
      artifactType,
      filename,
      buffer,
      contentType: guessContentType(filename),
      retentionClass,
      classification,
    }
  })

  const request: EvidencePackRequest = {
    packId,
    entityId,
    controlFamily,
    eventType,
    eventId,
    blobContainer,
    summary,
    controlsCovered: controls,
    createdBy,
    artifacts,
  }

  // ── Upload: delegate entirely to os-core ─────────────────────────────────────
  if (values.upload) {
    const { processEvidencePack } = await import('@nzila/os-core/evidence/generate-evidence-index')
    // ML evidence is collected by the canonical generator when includeMl flag is set
    // The actual collection logic lives in @nzila/os-core/evidence/collectors/ml-drift (collectMlEvidence)
    const result = await processEvidencePack(request, {
      basePath,
      periodLabel,
      includeMl: values['include-ml'] as boolean | undefined,
      includeAiActions: values['include-ai-actions'] as boolean | undefined,
    } as any)
    console.error(`✔ Evidence pack sealed.`)
    console.error(`  Pack ID:   ${result.packId}`)
    console.error(`  DB Pack:   ${result.evidencePackDbId}`)
    console.error(`  Artifacts: ${result.artifacts.length}`)
    console.error(`  Index:     ${result.indexBlobPath}`)
    console.error(`  Run ID:    ${result.runId}`)
    return
  }

  // ── Local mode: build index JSON via os-core builder ────────────────────────
  const { buildLocalEvidencePackIndex } = await import('@nzila/os-core/evidence/generate-evidence-index')
  const index = buildLocalEvidencePackIndex(request, { basePath, periodLabel })

  const outPath = values.out as string | undefined
  const json = JSON.stringify(index, null, 2)
  if (outPath) {
    const { writeFileSync, mkdirSync, existsSync } = await import('node:fs')
    const { dirname: dn } = await import('node:path')
    const dir = dn(resolve(outPath))
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(outPath), json, 'utf-8')
    console.error(`✔ Evidence pack index written to ${resolve(outPath)}`)
    console.error(`  Pack ID:   ${packId}`)
    console.error(`  Artifacts: ${artifacts.length}`)
  } else {
    process.stdout.write(json + '\n')
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})

