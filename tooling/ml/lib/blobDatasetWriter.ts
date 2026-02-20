/**
 * tooling/ml/lib/blobDatasetWriter.ts
 *
 * Writes a dataset CSV to Azure Blob, inserts documents + mlDatasets rows,
 * and emits an audit_event for lineage.
 */
import { createHash } from 'node:crypto'
import { db } from '@nzila/db'
import { documents, auditEvents, mlDatasets } from '@nzila/db/schema'
import { uploadBuffer } from '@nzila/blob'

export interface DatasetWriteOptions {
  entityId: string
  datasetKey: string
  periodStart: string          // YYYY-MM-DD
  periodEnd: string            // YYYY-MM-DD
  csvContent: string
  schemaJson: Record<string, string>   // column → dtype
  buildConfigJson: Record<string, unknown>
  createdBy: string            // clerk_user_id or 'system'
}

export interface DatasetWriteResult {
  datasetId: string
  documentId: string
  sha256: string
  rowCount: number
  blobPath: string
}

export async function writeBlobDataset(opts: DatasetWriteOptions): Promise<DatasetWriteResult> {
  const {
    entityId,
    datasetKey,
    periodStart,
    periodEnd,
    csvContent,
    schemaJson,
    buildConfigJson,
    createdBy,
  } = opts

  const buffer = Buffer.from(csvContent, 'utf-8')
  const sha256 = createHash('sha256').update(buffer).digest('hex')

  // Row count = lines - 1 (header)
  const rowCount = Math.max(0, csvContent.split('\n').filter(Boolean).length - 1)

  const blobPath = `exports/${entityId}/ml/datasets/${datasetKey}/${periodStart}-${periodEnd}/dataset.csv`

  // Upload to Blob
  const uploadResult = await uploadBuffer({
    container: 'exports',
    blobPath,
    buffer,
    contentType: 'text/csv',
  })

  // Insert documents row
  const [docRow] = await db
    .insert(documents)
    .values({
      entityId,
      category: 'other',
      title: `ML Dataset — ${datasetKey} (${periodStart} → ${periodEnd})`,
      blobContainer: 'exports',
      blobPath: uploadResult.blobPath,
      contentType: 'text/csv',
      sizeBytes: BigInt(buffer.length),
      sha256,
      uploadedBy: createdBy,
      classification: 'internal',
      linkedType: 'ml_dataset',
    })
    .returning({ id: documents.id })

  // Insert mlDatasets row
  const [datasetRow] = await db
    .insert(mlDatasets)
    .values({
      entityId,
      datasetKey,
      periodStart,
      periodEnd,
      rowCount,
      snapshotDocumentId: docRow.id,
      schemaJson,
      buildConfigJson,
      sha256,
    })
    .returning({ id: mlDatasets.id })

  // Audit event
  await db.insert(auditEvents).values({
    entityId,
    actorClerkUserId: createdBy,
    action: 'ml.dataset_built',
    targetType: 'ml_dataset',
    targetId: datasetRow.id,
    afterJson: {
      datasetKey,
      periodStart,
      periodEnd,
      rowCount,
      sha256,
      blobPath: uploadResult.blobPath,
    },
    hash: sha256, // deterministic; a real hash chain would use previous hash
    previousHash: null,
  })

  console.error(`✔ Dataset written: ${datasetKey} (${rowCount} rows) → ${uploadResult.blobPath}`)
  console.error(`  SHA-256: ${sha256}`)
  console.error(`  Document ID: ${docRow.id}`)
  console.error(`  Dataset ID:  ${datasetRow.id}`)

  return {
    datasetId: datasetRow.id,
    documentId: docRow.id,
    sha256,
    rowCount,
    blobPath: uploadResult.blobPath,
  }
}
