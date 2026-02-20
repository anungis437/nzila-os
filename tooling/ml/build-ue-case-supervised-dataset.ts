#!/usr/bin/env npx tsx
/**
 * tooling/ml/build-ue-case-supervised-dataset.ts
 *
 * Builds two supervised ML datasets for Union Eyes cases:
 *   - ue_case_priority_dataset_v1   (multi-class: y_priority)
 *   - ue_case_sla_dataset_v1        (binary: y_sla_breached)
 *
 * Both datasets share the same feature matrix; only the label column differs.
 * A deterministic split_key column (hash(caseId) % 10) is included:
 *   0-7 → train, 8 → val, 9 → test
 *
 * Usage:
 *   npx tsx tooling/ml/build-ue-case-supervised-dataset.ts \
 *     --entity-id <uuid> \
 *     --start 2025-01-01 \
 *     --end 2025-12-31 \
 *     [--created-by system]
 *
 * Output:
 *   exports/{entityId}/ml/datasets/ue_case_priority_dataset_v1/{start}-{end}/dataset.csv
 *   exports/{entityId}/ml/datasets/ue_case_sla_dataset_v1/{start}-{end}/dataset.csv
 *
 * Requires: DATABASE_URL, AZURE_STORAGE_ACCOUNT_NAME, AZURE_STORAGE_ACCOUNT_KEY
 *
 * === Expected UE case table columns ===
 * The query below targets a table named `ue_cases` with the following columns
 * (adjust the raw SQL if your schema differs):
 *   id              uuid         — case primary key
 *   entity_id       uuid         — entity scoping FK
 *   created_at      timestamptz  — case creation time
 *   updated_at      timestamptz  — last update time
 *   category        text         — case category/type
 *   channel         text         — intake channel
 *   status          text         — current workflow status
 *   assigned_queue  text         — queue assignment (team-level only)
 *   priority        text         — native priority label (low/medium/high/critical)
 *   sla_breached    boolean      — ground-truth SLA breach flag
 *   reopen_count    int          — number of reopens
 *   message_count   int          — total messages on case
 *   attachment_count int         — number of attachments
 */
import { parseArgs } from 'node:util'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@nzila/db'
import { ueCases } from '@nzila/db/schema'
import {
  buildUECaseFeatures,
  toCsv,
  UE_CASE_SCHEMA_JSON,
  type RawUECase,
} from './lib/ueFeatureEngineering'
import { writeBlobDataset } from './lib/blobDatasetWriter'

const { values } = parseArgs({
  options: {
    'entity-id': { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
    'created-by': { type: 'string', default: 'system' },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help) {
  console.log(`
Usage: npx tsx tooling/ml/build-ue-case-supervised-dataset.ts \\
  --entity-id <uuid> \\
  --start YYYY-MM-DD \\
  --end YYYY-MM-DD \\
  --created-by system
`)
  process.exit(0)
}

function fatal(msg: string): never {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

// ── Query UE cases ────────────────────────────────────────────────────────────

async function fetchRawCases(
  entityId: string,
  periodStart: string,
  periodEnd: string,
): Promise<RawUECase[]> {
  // Use Drizzle ORM against the canonical ueCases schema so column names are
  // enforced at compile time — no silent runtime failures from schema drift.
  const rows = await db
    .select({
      caseId: ueCases.id,
      entityId: ueCases.entityId,
      createdAt: ueCases.createdAt,
      updatedAt: ueCases.updatedAt,
      category: ueCases.category,
      channel: ueCases.channel,
      currentStatus: ueCases.status,
      assignedQueue: ueCases.assignedQueue,
      priority: ueCases.priority,
      slaBreached: ueCases.slaBreached,
      reopenCount: ueCases.reopenCount,
      messageCount: ueCases.messageCount,
      attachmentCount: ueCases.attachmentCount,
    })
    .from(ueCases)
    .where(
      and(
        eq(ueCases.entityId, entityId),
        gte(ueCases.createdAt, new Date(periodStart + 'T00:00:00Z')),
        lte(ueCases.createdAt, new Date(periodEnd + 'T23:59:59Z')),
      ),
    )
    .orderBy(ueCases.createdAt)

  return rows.map((r) => ({
    caseId: r.caseId,
    entityId: r.entityId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    category: r.category,
    channel: r.channel,
    currentStatus: r.currentStatus,
    assignedQueue: r.assignedQueue,
    priority: r.priority,
    slaBreached: r.slaBreached,
    reopenCount: r.reopenCount ?? 0,
    messageCount: r.messageCount ?? 0,
    attachmentCount: r.attachmentCount ?? 0,
  }))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const entityId = values['entity-id'] ?? fatal('--entity-id is required')
  const periodStart = values.start ?? fatal('--start is required')
  const periodEnd = values.end ?? fatal('--end is required')
  const createdBy = values['created-by'] as string

  console.error(
    `Building UE supervised datasets for ${entityId} (${periodStart} → ${periodEnd})`,
  )

  // Fetch raw case rows
  const rawCases = await fetchRawCases(entityId, periodStart, periodEnd)
  console.error(`  Loaded ${rawCases.length} raw UE case rows`)

  if (rawCases.length === 0) {
    fatal(
      `No UE case rows found for entity ${entityId} in period ${periodStart}→${periodEnd}. ` +
        `Verify that ue_cases table has data for this entity/period.`,
    )
  }

  // Build engineered feature rows
  const featureRows = buildUECaseFeatures(rawCases)
  console.error(`  Engineered ${featureRows.length} feature rows (${rawCases.length - featureRows.length} dropped due to missing priority label)`)

  if (featureRows.length === 0) {
    fatal(`All rows were dropped due to missing priority labels. Populate priority field before building dataset.`)
  }

  // Log split distribution
  const trainCount = featureRows.filter((r) => r.split_key <= 7).length
  const valCount = featureRows.filter((r) => r.split_key === 8).length
  const testCount = featureRows.filter((r) => r.split_key === 9).length
  console.error(`  Split: train=${trainCount}, val=${valCount}, test=${testCount}`)

  // Produce CSV (same feature matrix for both datasets — label differs by column)
  const csv = toCsv(featureRows)

  const buildBase = {
    script: 'build-ue-case-supervised-dataset.ts',
    periodStart,
    periodEnd,
    entityId,
    totalRows: featureRows.length,
    trainRows: trainCount,
    valRows: valCount,
    testRows: testCount,
    builtAt: new Date().toISOString(),
  }

  // ── Write priority dataset ────────────────────────────────────────────────

  console.error('\n  Writing ue_case_priority_dataset_v1 …')
  const priorityResult = await writeBlobDataset({
    entityId,
    datasetKey: 'ue_case_priority_dataset_v1',
    periodStart,
    periodEnd,
    csvContent: csv,
    schemaJson: UE_CASE_SCHEMA_JSON,
    buildConfigJson: { ...buildBase, targetLabel: 'y_priority' },
    createdBy,
  })
  console.error(`  ✔ Priority dataset: ${priorityResult.datasetId} (sha256: ${priorityResult.sha256.slice(0, 12)}…)`)

  // ── Write SLA dataset ─────────────────────────────────────────────────────

  console.error('\n  Writing ue_case_sla_dataset_v1 …')
  const slaResult = await writeBlobDataset({
    entityId,
    datasetKey: 'ue_case_sla_dataset_v1',
    periodStart,
    periodEnd,
    csvContent: csv,
    schemaJson: UE_CASE_SCHEMA_JSON,
    buildConfigJson: { ...buildBase, targetLabel: 'y_sla_breached' },
    createdBy,
  })
  console.error(`  ✔ SLA dataset: ${slaResult.datasetId} (sha256: ${slaResult.sha256.slice(0, 12)}…)`)

  console.error('\n✔ Done.')
  console.error(JSON.stringify({ priorityDataset: priorityResult, slaDataset: slaResult }, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
