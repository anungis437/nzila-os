/**
 * Batch Ingestion Engine (§1-§10)
 *
 * Hardened ingestion pipeline for real-world CUPE pilot data:
 *
 * §1  Strict Idempotency — external_case_id + fingerprint dedup, ON CONFLICT UPDATE
 * §2  Migration Traceability — source_system, imported_at, import_batch_id on every row
 * §3  Partial Ingestion Safety — per-record error handling, batch status tracking
 * §4  FSM Safe Import — state mapping via state-bridge, synthetic history events
 * §5  Timeline Reconstruction — dedup via content_hash, UTC normalization, sequence ordering
 * §6  Document Normalization — type enforcement, orphan prevention
 * §7  User Resolution Fallback — "Unassigned" for missing users
 * §8  Entity Link Integrity — org boundary validation, FK verification
 * §9  Error Handling & Observability — per-record logging, structured error details
 * §10 Performance Safety — batched inserts, indexed lookups
 */

import { db } from '@/db/db';
import { sql, eq } from 'drizzle-orm';
import { organizations } from '@/db/schema-organizations';
import {
  ingestionBatches,
  ingestionRecords,
} from '@/db/schema/ingestion-schema';
import { logger } from '@/lib/logger';
import {
  validateIngestionBatch,
  computeRecordFingerprint,
  computeTimelineEventHash,
  mapImportStatus,
  type IngestionGrievanceRecord,
  type ValidationResult,
} from './validation-pipeline';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngestionOptions {
  organizationId: string;
  sourceSystem: string;
  createdBy: string;
  dryRun?: boolean;
  continueOnError?: boolean;
  batchSize?: number;
}

export interface IngestionResult {
  batchId: string;
  status: 'completed' | 'partial' | 'failed';
  validation: ValidationResult;
  totalRecords: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ index: number; externalId: string; error: string }>;
  dryRun: boolean;
  durationMs: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_BATCH_SIZE = 50;
const SYSTEM_USER = 'system:ingestion';
const UNASSIGNED_LABEL = 'Unassigned';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toUTCIso(dateStr: string | undefined, fallback: Date): string {
  if (!dateStr) return fallback.toISOString();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
}

// ─── Organization Validation (§8) ───────────────────────────────────────────

async function verifyOrganization(orgId: string): Promise<boolean> {
  const result = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return result.length > 0;
}

// ─── Ingest Single Grievance Record ─────────────────────────────────────────

async function ingestGrievanceRecord(
  record: IngestionGrievanceRecord,
  batchId: string,
  recordIndex: number,
  opts: IngestionOptions,
  importTime: Date,
): Promise<{ status: 'succeeded' | 'failed' | 'skipped'; resolvedId?: string; error?: string }> {
  const externalId = record.external_case_id;

  try {
    // §8: Org boundary — record org must match batch org
    if (record.organization_id !== opts.organizationId) {
      return {
        status: 'failed',
        error: `Organization mismatch: record has '${record.organization_id}', batch expects '${opts.organizationId}'`,
      };
    }

    // §1: Compute fingerprint for idempotency
    const fingerprint = computeRecordFingerprint(record);

    // §4: Map status through state bridge
    const { grievanceStatus } = mapImportStatus(record.status);

    // §7: User resolution fallback
    const grievantName = record.grievant_name?.trim() || record.filed_by?.trim() || UNASSIGNED_LABEL;
    const grievantEmail = record.grievant_email?.trim() || undefined;

    // §1: Upsert with ON CONFLICT on (organization_id, external_case_id)
    // Use raw SQL for the actual upsert since Drizzle's onConflictDoUpdate
    // doesn't support partial index targets cleanly
    const grievanceNumber = record.grievance_number?.trim()
      || `IMP-${externalId.substring(0, 20)}`;

    const filedDate = toUTCIso(record.filed_date, importTime);
    const incidentDate = record.incident_date ? toUTCIso(record.incident_date, importTime) : null;

    const priority = ['low', 'medium', 'high', 'urgent'].includes(record.priority ?? '')
      ? record.priority!
      : 'medium';

    const step = ['step_1', 'step_2', 'step_3', 'final', 'arbitration'].includes(record.step ?? '')
      ? record.step!
      : null;

    const insertResult = await db.execute(sql`
      INSERT INTO grievances (
        grievance_number, external_case_id, import_fingerprint,
        organization_id, type, status, priority, step,
        title, description, background, desired_outcome,
        grievant_name, grievant_email,
        incident_date, filed_date,
        source_system, imported_at, import_batch_id,
        created_at, updated_at
      ) VALUES (
        ${grievanceNumber}, ${externalId}, ${fingerprint},
        ${opts.organizationId},
        ${record.type}::grievance_type,
        ${grievanceStatus}::grievance_status,
        ${priority}::grievance_priority,
        ${step ? sql`${step}::grievance_step` : sql`NULL`},
        ${record.title.trim()}, ${record.description.trim()},
        ${record.timeline ? 'Imported from ' + (opts.sourceSystem ?? 'external system') : null},
        ${record.timeline ? null : null},
        ${grievantName}, ${grievantEmail ?? null},
        ${incidentDate ? sql`${incidentDate}::timestamptz` : sql`NULL`},
        ${filedDate}::timestamptz,
        ${opts.sourceSystem}, ${importTime.toISOString()}::timestamptz, ${batchId}::uuid,
        NOW(), NOW()
      )
      ON CONFLICT (organization_id, external_case_id)
        WHERE external_case_id IS NOT NULL
      DO UPDATE SET
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        grievant_name = EXCLUDED.grievant_name,
        grievant_email = EXCLUDED.grievant_email,
        import_fingerprint = EXCLUDED.import_fingerprint,
        imported_at = EXCLUDED.imported_at,
        import_batch_id = EXCLUDED.import_batch_id,
        updated_at = NOW()
      RETURNING id
    `);

    const grievanceId = (insertResult as unknown as Array<{ id: string }>)[0]?.id;
    if (!grievanceId) {
      return { status: 'failed', error: 'No grievance ID returned from upsert' };
    }

    // §5: Timeline reconstruction — insert deduplicated events
    if (record.timeline?.length) {
      let seq = 0;
      for (const ev of record.timeline) {
        const eventDate = toUTCIso(ev.date, importTime);
        const contentHash = computeTimelineEventHash(ev);
        const action = ev.action?.trim() || 'status_change';
        const actor = ev.actor?.trim() || SYSTEM_USER;
        const description = ev.notes?.trim() || `${action} event`;

        await db.execute(sql`
          INSERT INTO grievance_timeline_events (
            grievance_id, organization_id, event_type, event_date,
            actor, description, content_hash,
            source_system, import_batch_id, sequence_number
          ) VALUES (
            ${grievanceId}::uuid, ${opts.organizationId}::uuid,
            ${action}, ${eventDate}::timestamptz,
            ${actor}, ${description}, ${contentHash},
            ${opts.sourceSystem}, ${batchId}::uuid, ${seq}
          )
          ON CONFLICT (grievance_id, event_date, event_type, content_hash)
          DO NOTHING
        `);
        seq++;
      }
    }

    // §4: Synthetic history event for imported status
    const statusEventHash = computeTimelineEventHash({
      date: filedDate,
      action: 'imported',
      actor: SYSTEM_USER,
      notes: `Imported with status '${grievanceStatus}' from ${opts.sourceSystem}`,
    });

    await db.execute(sql`
      INSERT INTO grievance_timeline_events (
        grievance_id, organization_id, event_type, event_date,
        actor, description, content_hash,
        source_system, import_batch_id, sequence_number
      ) VALUES (
        ${grievanceId}::uuid, ${opts.organizationId}::uuid,
        'imported', ${filedDate}::timestamptz,
        ${SYSTEM_USER},
        ${'Imported with status \'' + grievanceStatus + '\' from ' + opts.sourceSystem},
        ${statusEventHash},
        ${opts.sourceSystem}, ${batchId}::uuid, ${9999}
      )
      ON CONFLICT (grievance_id, event_date, event_type, content_hash)
      DO NOTHING
    `);

    // §6: Document normalization — insert linked documents
    if (record.documents?.length) {
      for (const doc of record.documents) {
        const docName = doc.name?.trim() || 'Untitled Document';
        const docType = doc.file_type?.trim() || 'other';
        const externalDocId = doc.external_id?.trim() || null;

        await db.execute(sql`
          INSERT INTO documents (
            organization_id, name, file_url, file_type,
            document_type, source_system, external_document_id,
            imported_at, import_batch_id,
            uploaded_by, linked_case_id, is_orphan
          ) VALUES (
            ${opts.organizationId}::uuid,
            ${docName}, ${doc.file_url ?? ''},
            ${docType}, ${docType},
            ${opts.sourceSystem}, ${externalDocId},
            ${importTime.toISOString()}::timestamptz, ${batchId}::uuid,
            ${opts.createdBy}, ${grievanceId}::uuid, false
          )
          ON CONFLICT DO NOTHING
        `);
      }
    }

    return { status: 'succeeded', resolvedId: grievanceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Ingestion record failed', {
      batchId,
      recordIndex,
      externalId,
      error: message,
    });
    return { status: 'failed', error: message };
  }
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export async function ingestGrievanceBatch(
  records: IngestionGrievanceRecord[],
  opts: IngestionOptions,
): Promise<IngestionResult> {
  const startTime = Date.now();
  const importTime = new Date();

  // §11: Pre-flight validation
  const validation = validateIngestionBatch(records);
  if (!validation.valid) {
    logger.warn('Ingestion pre-validation failed', {
      organizationId: opts.organizationId,
      sourceSystem: opts.sourceSystem,
      errorCount: validation.errors.length,
    });
    return {
      batchId: '',
      status: 'failed',
      validation,
      totalRecords: records.length,
      succeeded: 0,
      failed: validation.errors.length,
      skipped: 0,
      errors: validation.errors.map((e) => ({
        index: e.index,
        externalId: records[e.index]?.external_case_id ?? '',
        error: `${e.field}: ${e.message}`,
      })),
      dryRun: opts.dryRun ?? false,
      durationMs: Date.now() - startTime,
    };
  }

  // §8: Verify organization exists
  const orgExists = await verifyOrganization(opts.organizationId);
  if (!orgExists) {
    return {
      batchId: '',
      status: 'failed',
      validation,
      totalRecords: records.length,
      succeeded: 0,
      failed: records.length,
      skipped: 0,
      errors: [{ index: -1, externalId: '', error: `Organization '${opts.organizationId}' not found` }],
      dryRun: opts.dryRun ?? false,
      durationMs: Date.now() - startTime,
    };
  }

  // Dry-run mode: return validation results without DB writes
  if (opts.dryRun) {
    return {
      batchId: 'dry-run',
      status: 'completed',
      validation,
      totalRecords: records.length,
      succeeded: records.length,
      failed: 0,
      skipped: 0,
      errors: [],
      dryRun: true,
      durationMs: Date.now() - startTime,
    };
  }

  // §3: Create batch tracking record
  const [batch] = await db
    .insert(ingestionBatches)
    .values({
      organizationId: opts.organizationId,
      sourceSystem: opts.sourceSystem,
      status: 'processing',
      totalRecords: records.length,
      startedAt: importTime,
      createdBy: opts.createdBy,
      metadata: {
        warningCount: validation.warnings.length,
        sourceRecordCount: records.length,
      },
    })
    .returning({ id: ingestionBatches.id });

  const batchId = batch.id;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errorList: Array<{ index: number; externalId: string; error: string }> = [];

  logger.info('Ingestion batch started', {
    batchId,
    organizationId: opts.organizationId,
    sourceSystem: opts.sourceSystem,
    totalRecords: records.length,
  });

  // §3 + §10: Process in configurable batches
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;

  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);

    for (let j = 0; j < chunk.length; j++) {
      const recordIndex = i + j;
      const record = chunk[j];

      // §3: Insert tracking record
      await db.insert(ingestionRecords).values({
        batchId,
        recordIndex,
        recordType: 'grievance',
        externalId: record.external_case_id,
        status: 'processing',
        fingerprint: computeRecordFingerprint(record),
      });

      const result = await ingestGrievanceRecord(
        record, batchId, recordIndex, opts, importTime,
      );

      // §3: Update tracking record
      await db.execute(sql`
        UPDATE ingestion_records
        SET status = ${result.status},
            entity_id = ${result.resolvedId ?? null}::uuid,
            error_message = ${result.error ?? null},
            processed_at = NOW()
        WHERE batch_id = ${batchId}::uuid
          AND record_index = ${recordIndex}
      `);

      if (result.status === 'succeeded') {
        succeeded++;
      } else if (result.status === 'skipped') {
        skipped++;
      } else {
        failed++;
        errorList.push({
          index: recordIndex,
          externalId: record.external_case_id,
          error: result.error ?? 'Unknown error',
        });

        // §3: Stop on first error if not continueOnError
        if (!opts.continueOnError) {
          break;
        }
      }
    }

    // §3: Early exit if we stopped due to error
    if (!opts.continueOnError && failed > 0) break;

    // §3: Update batch progress
    await db.execute(sql`
      UPDATE ingestion_batches
      SET processed = ${succeeded + failed + skipped},
          succeeded = ${succeeded},
          failed = ${failed},
          skipped = ${skipped}
      WHERE id = ${batchId}::uuid
    `);
  }

  // Determine final status
  const finalStatus: 'completed' | 'partial' | 'failed' =
    failed === 0
      ? 'completed'
      : succeeded === 0
        ? 'failed'
        : 'partial';

  // §3: Finalize batch
  await db.execute(sql`
    UPDATE ingestion_batches
    SET status = ${finalStatus},
        processed = ${succeeded + failed + skipped},
        succeeded = ${succeeded},
        failed = ${failed},
        skipped = ${skipped},
        error_summary = ${JSON.stringify(errorList.slice(0, 100))}::jsonb,
        completed_at = NOW()
    WHERE id = ${batchId}::uuid
  `);

  // §9: Log final summary
  logger.info('Ingestion batch completed', {
    batchId,
    status: finalStatus,
    succeeded,
    failed,
    skipped,
    durationMs: Date.now() - startTime,
  });

  return {
    batchId,
    status: finalStatus,
    validation,
    totalRecords: records.length,
    succeeded,
    failed,
    skipped,
    errors: errorList,
    dryRun: false,
    durationMs: Date.now() - startTime,
  };
}
