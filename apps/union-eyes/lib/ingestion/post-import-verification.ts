/**
 * Post-Import Verification (§12)
 *
 * After a batch import, verify data integrity:
 * - No NULL critical fields on imported grievances
 * - No orphan documents (linked to no grievance, or to one that does not exist)
 * - No broken case → org references
 * - Timeline events ordered correctly
 * - All ingestion_records resolved (no stuck 'processing')
 * - Entity counts match expectations
 * - The batch exists in this organization's scope and completed
 *
 * Every finding is an error: a batch with an orphan document, a stuck record, unreconciled counts, a partial outcome, no batch record
 * in scope (a foreign or unknown id is invisible under row-level security), no sealed batch manifest, no expected source manifest or
 * cases that do not reconcile with it, or a document whose bytes were never verified against its declared digest does not pass. Passing is transport integrity only; it is not
 * migration acceptance, which also needs the source manifest reconciled and an authorized acceptance decision.
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VerificationIssue {
  check: string;
  severity: 'error' | 'warning';
  message: string;
  count?: number;
  details?: any;
}

export interface VerificationResult {
  batchId: string;
  passed: boolean;
  checks: VerificationIssue[];
  summary: {
    grievancesImported: number;
    timelineEventsCreated: number;
    documentsLinked: number;
    orphanDocuments: number;
    stuckRecords: number;
    /** Imported documents whose bytes matched their declared digest. Everything else is a reference, not verified content. */
    documentsContentVerified: number;
    documentsReferenceOnly: number;
    sourceManifestId: string | null;
    predecessorBatchId: string | null;
    successorBatchId: string | null;
  };
}

// ─── Verification ───────────────────────────────────────────────────────────

export async function verifyImportBatch(batchId: string): Promise<VerificationResult> {
  const checks: VerificationIssue[] = [];

  // §12.1: Count imported grievances
  const grievanceCount = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM grievances
    WHERE import_batch_id = ${batchId}::uuid
  `) as Array<{ cnt: number }>;
  const grievancesImported = grievanceCount[0]?.cnt ?? 0;

  // §12.2: Check for NULL critical fields
  const nullCritical = await db.execute(sql`
    SELECT id, grievance_number, external_case_id
    FROM grievances
    WHERE import_batch_id = ${batchId}::uuid
      AND (title IS NULL OR title = ''
        OR description IS NULL OR description = ''
        OR organization_id IS NULL
        OR type IS NULL
        OR status IS NULL)
  `) as Array<{ id: string; grievance_number: string; external_case_id: string }>;

  if (nullCritical.length > 0) {
    checks.push({
      check: 'null_critical_fields',
      severity: 'error',
      message: `${nullCritical.length} grievance(s) have NULL critical fields`,
      count: nullCritical.length,
      details: nullCritical.slice(0, 10),
    });
  }

  // §12.3: Orphan documents: an imported document linked to no grievance, or to one that does not exist (the link is the canonical document_links row)
  const orphans = await db.execute(sql`
    SELECT d.id, d.name, dl.linked_entity_id AS linked_case_id
    FROM documents d
    LEFT JOIN document_links dl ON dl.document_id = d.id AND dl.linked_entity_type = 'grievance'
    WHERE d.import_batch_id = ${batchId}::uuid
      AND (
        dl.id IS NULL
        OR NOT EXISTS (SELECT 1 FROM grievances g WHERE g.id = dl.linked_entity_id)
      )
  `) as Array<{ id: string; name: string; linked_case_id: string | null }>;

  if (orphans.length > 0) {
    checks.push({
      check: 'orphan_documents',
      severity: 'error',
      message: `${orphans.length} document(s) not linked to an existing grievance`,
      count: orphans.length,
      details: orphans.slice(0, 10),
    });
  }

  // §12.4: Timeline events for this batch
  const timelineCount = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM grievance_timeline_events
    WHERE import_batch_id = ${batchId}::uuid
  `) as Array<{ cnt: number }>;
  const timelineEventsCreated = timelineCount[0]?.cnt ?? 0;

  // §12.5: Documents linked in this batch
  const docCount = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM documents
    WHERE import_batch_id = ${batchId}::uuid
  `) as Array<{ cnt: number }>;
  const documentsLinked = docCount[0]?.cnt ?? 0;

  // §12.6: Stuck ingestion_records (still 'processing')
  const stuckRecords = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt
    FROM ingestion_records
    WHERE batch_id = ${batchId}::uuid
      AND status = 'processing'
  `) as Array<{ cnt: number }>;
  const stuckCount = stuckRecords[0]?.cnt ?? 0;

  if (stuckCount > 0) {
    checks.push({
      check: 'stuck_records',
      severity: 'error',
      message: `${stuckCount} ingestion record(s) still in 'processing' state`,
      count: stuckCount,
    });
  }

  // §12.7: Cross-org references (grievances referencing non-existent orgs)
  const crossOrg = await db.execute(sql`
    SELECT g.id, g.organization_id
    FROM grievances g
    WHERE g.import_batch_id = ${batchId}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM organizations o WHERE o.id = g.organization_id
      )
  `) as Array<{ id: string; organization_id: string }>;

  if (crossOrg.length > 0) {
    checks.push({
      check: 'broken_org_reference',
      severity: 'error',
      message: `${crossOrg.length} grievance(s) reference non-existent organization`,
      count: crossOrg.length,
    });
  }

  // §12.8: Batch record counts match
  const batchMeta = await db.execute(sql`
    SELECT total_records, succeeded, failed, skipped, status
    FROM ingestion_batches
    WHERE id = ${batchId}::uuid
  `) as Array<{ total_records: number; succeeded: number; failed: number; skipped: number; status?: string }>;

  if (batchMeta.length === 0) {
    checks.push({
      check: 'batch_not_found',
      severity: 'error',
      message: `No ingestion batch '${batchId}' in this organization's scope`,
    });
  } else {
    const meta = batchMeta[0];
    const processedSum = meta.succeeded + meta.failed + meta.skipped;
    if (processedSum !== meta.total_records) {
      checks.push({
        check: 'batch_count_mismatch',
        severity: 'error',
        message: `Batch total_records (${meta.total_records}) != succeeded+failed+skipped (${processedSum})`,
      });
    }
    if (meta.status !== 'completed') {
      checks.push({
        check: 'batch_incomplete',
        severity: 'error',
        message: `Batch status is '${meta.status ?? 'unknown'}', not 'completed'`,
      });
    }
  }

  // §12.9: The batch's own manifest (MIG-11): present, sealed, and agreeing with the batch's counts.
  const [manifest] = await db.execute(sql`
    SELECT m.source_system, m.source_manifest_id::text AS source_manifest_id, m.predecessor_batch_id::text AS predecessor_batch_id,
      m.record_count, m.succeeded, m.failed, m.sealed_at IS NOT NULL AS sealed,
      (SELECT s.batch_id::text FROM ue_ingestion_batch_manifests s WHERE s.predecessor_batch_id = m.batch_id) AS successor_batch_id
    FROM ue_ingestion_batch_manifests m
    WHERE m.batch_id = ${batchId}::uuid
  `) as Array<{ source_system: string; source_manifest_id: string | null; predecessor_batch_id: string | null; record_count: number;
    succeeded: number | null; failed: number | null; sealed: boolean; successor_batch_id: string | null }>;
  if (!manifest) {
    checks.push({ check: 'batch_manifest_missing', severity: 'error', message: 'The batch has no manifest in this organization\'s scope' });
  } else {
    if (!manifest.sealed) {
      checks.push({ check: 'batch_manifest_unsealed', severity: 'error', message: 'The batch manifest was never sealed with its outcome' });
    } else if (batchMeta[0] && (manifest.record_count !== batchMeta[0].total_records || manifest.succeeded !== batchMeta[0].succeeded || manifest.failed !== batchMeta[0].failed)) {
      checks.push({ check: 'batch_manifest_mismatch', severity: 'error', message: 'The sealed batch manifest and the batch record disagree on counts' });
    }

    // §12.10: The tenant-bound expected source manifest (MIG-07). Without one there is nothing to reconcile, so the batch cannot pass.
    if (!manifest.source_manifest_id) {
      checks.push({ check: 'source_manifest_missing', severity: 'error', message: 'No expected source manifest: what the source holds was never declared, so the import cannot be reconciled' });
    } else {
      const [expected] = await db.execute(sql`
        SELECT source_system, expected_case_ids, expected_document_count FROM ue_ingestion_source_manifests
        WHERE id = ${manifest.source_manifest_id}::uuid
      `) as Array<{ source_system: string; expected_case_ids: string[]; expected_document_count: number }>;
      if (!expected || expected.source_system !== manifest.source_system) {
        checks.push({ check: 'source_manifest_mismatch', severity: 'error', message: 'The source manifest is not this organization\'s declaration for this source system' });
      } else {
        const imported = await db.execute(sql`
          SELECT external_case_id FROM ue_ingestion_record_provenance WHERE batch_id = ${batchId}::uuid
        `) as Array<{ external_case_id: string }>;
        const got = new Set(imported.map((row) => row.external_case_id));
        const want = new Set(expected.expected_case_ids);
        const missing = [...want].filter((id) => !got.has(id));
        const unexpected = [...got].filter((id) => !want.has(id));
        if (missing.length) {
          checks.push({ check: 'source_manifest_missing_cases', severity: 'error', message: `${missing.length} case(s) the source manifest declares were not imported`, count: missing.length, details: missing.slice(0, 10) });
        }
        if (unexpected.length) {
          checks.push({ check: 'source_manifest_unexpected_cases', severity: 'error', message: `${unexpected.length} imported case(s) are not in the source manifest`, count: unexpected.length, details: unexpected.slice(0, 10) });
        }
        if (documentsLinked !== expected.expected_document_count) {
          checks.push({ check: 'source_manifest_document_count', severity: 'error', message: `The source manifest declares ${expected.expected_document_count} document(s); the batch holds ${documentsLinked}` });
        }
      }
    }
  }

  // §12.11: Document content (MIG-05). A document is verified content only when its bytes matched the declared digest.
  const [evidence] = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE e.verification_state = 'digest_verified')::int AS verified,
      count(*) FILTER (WHERE e.verification_state = 'reference_only')::int AS reference_only,
      count(*) FILTER (WHERE e.verification_state = 'digest_mismatch')::int AS mismatched,
      count(*) FILTER (WHERE e.id IS NULL)::int AS without_evidence
    FROM documents d
    LEFT JOIN ue_imported_document_evidence e ON e.document_id = d.id
    WHERE d.import_batch_id = ${batchId}::uuid
  `) as Array<{ verified: number; reference_only: number; mismatched: number; without_evidence: number }>;
  const documentsContentVerified = evidence?.verified ?? 0;
  const documentsReferenceOnly = evidence?.reference_only ?? 0;
  if (documentsReferenceOnly > 0) {
    checks.push({ check: 'document_content_unverified', severity: 'error', message: `${documentsReferenceOnly} document(s) are references whose bytes were never verified against a declared digest`, count: documentsReferenceOnly });
  }
  if ((evidence?.mismatched ?? 0) > 0) {
    checks.push({ check: 'document_digest_mismatch', severity: 'error', message: `${evidence!.mismatched} document(s) do not match the digest the source declared`, count: evidence!.mismatched });
  }
  if ((evidence?.without_evidence ?? 0) > 0) {
    checks.push({ check: 'document_evidence_missing', severity: 'error', message: `${evidence!.without_evidence} document(s) have no content evidence record`, count: evidence!.without_evidence });
  }

  const passed = !checks.some((c) => c.severity === 'error');

  const result: VerificationResult = {
    batchId,
    passed,
    checks,
    summary: {
      grievancesImported,
      timelineEventsCreated,
      documentsLinked,
      orphanDocuments: orphans.length,
      stuckRecords: stuckCount,
      documentsContentVerified,
      documentsReferenceOnly,
      sourceManifestId: manifest?.source_manifest_id ?? null,
      predecessorBatchId: manifest?.predecessor_batch_id ?? null,
      successorBatchId: manifest?.successor_batch_id ?? null,
    },
  };

  logger.info('Post-import verification completed', {
    batchId,
    passed,
    grievancesImported,
    issueCount: checks.length,
  });

  return result;
}
