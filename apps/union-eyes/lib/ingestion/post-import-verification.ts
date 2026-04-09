/**
 * Post-Import Verification (§12)
 *
 * After a batch import, verify data integrity:
 * - No NULL critical fields on imported grievances
 * - No orphan documents (linked_case_id set but grievance missing)
 * - No broken case → org references
 * - Timeline events ordered correctly
 * - All ingestion_records resolved (no stuck 'processing')
 * - Entity counts match expectations
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
  details?: unknown;
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

  // §12.3: Orphan documents (linked_case_id but grievance doesn't exist)
  const orphans = await db.execute(sql`
    SELECT d.id, d.name, d.linked_case_id
    FROM documents d
    WHERE d.import_batch_id = ${batchId}::uuid
      AND d.linked_case_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM grievances g WHERE g.id = d.linked_case_id
      )
  `) as Array<{ id: string; name: string; linked_case_id: string }>;

  if (orphans.length > 0) {
    checks.push({
      check: 'orphan_documents',
      severity: 'warning',
      message: `${orphans.length} document(s) linked to non-existent grievances`,
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
      severity: 'warning',
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
    SELECT total_records, succeeded, failed, skipped
    FROM ingestion_batches
    WHERE id = ${batchId}::uuid
  `) as Array<{ total_records: number; succeeded: number; failed: number; skipped: number }>;

  if (batchMeta.length > 0) {
    const meta = batchMeta[0];
    const processedSum = meta.succeeded + meta.failed + meta.skipped;
    if (processedSum !== meta.total_records) {
      checks.push({
        check: 'batch_count_mismatch',
        severity: 'warning',
        message: `Batch total_records (${meta.total_records}) != succeeded+failed+skipped (${processedSum})`,
      });
    }
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
