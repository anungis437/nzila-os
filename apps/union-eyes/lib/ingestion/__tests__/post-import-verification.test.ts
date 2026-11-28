/**
 * Tests for Post-Import Verification (§12)
 *
 * Covers:
 * - Grievance count accuracy
 * - NULL critical field detection
 * - Orphan document detection
 * - Stuck ingestion record detection
 * - Broken org references
 * - Batch count consistency
 * - Summary structure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted mocks ─────────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

/* ── module mocks ──────────────────────────────────────────────────────────── */
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db/db', () => ({
  db: {
    execute: (...a: any[]) => mocks.mockExecute(...a),
  },
}));

// ─── Import under test ──────────────────────────────────────────────────────

import { verifyImportBatch } from '../post-import-verification';
import { PgDialect } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();
const textOf = (query: unknown) => dialect.sqlToQuery(query as never).sql;

/**
 * The eight transport checks get their responses in order from each test. The manifest and content checks that follow
 * (§12.9–§12.11) are answered here, consistently with that test's own batch record and document count, as a clean
 * import would leave them; `manifestState` lets a test break one of them.
 */
const manifestState = vi.hoisted(() => ({ manifest: 'clean' as 'clean' | 'absent' | 'unsealed' | 'no-source', missingCase: false, evidence: 'verified' as 'verified' | 'reference' | 'mismatch' }));

async function settled(index: number): Promise<any> {
  const result = mocks.mockExecute.mock.results[index];
  return result ? await result.value : undefined;
}

async function manifestResponder(query: unknown): Promise<unknown[]> {
  const text = textOf(query);
  const meta = (await settled(7))?.[0];
  const documents = (await settled(4))?.[0]?.cnt ?? 0;
  if (text.includes('FROM ue_ingestion_batch_manifests m')) {
    if (manifestState.manifest === 'absent' || !meta) return [];
    return [{
      source_system: 'legacy', source_manifest_id: manifestState.manifest === 'no-source' ? null : 'manifest-1', predecessor_batch_id: null,
      record_count: meta.total_records, succeeded: manifestState.manifest === 'unsealed' ? null : meta.succeeded,
      failed: manifestState.manifest === 'unsealed' ? null : meta.failed, sealed: manifestState.manifest !== 'unsealed', successor_batch_id: null,
    }];
  }
  if (text.includes('FROM ue_ingestion_source_manifests')) {
    return [{ source_system: 'legacy', expected_case_ids: manifestState.missingCase ? ['C-1', 'C-2'] : ['C-1'], expected_document_count: documents }];
  }
  if (text.includes('FROM ue_ingestion_record_provenance')) return [{ external_case_id: 'C-1' }];
  if (text.includes('ue_imported_document_evidence')) {
    return [{
      verified: manifestState.evidence === 'verified' ? documents : 0,
      reference_only: manifestState.evidence === 'reference' ? documents : 0,
      mismatched: manifestState.evidence === 'mismatch' ? documents : 0,
      without_evidence: 0,
    }];
  }
  return [];
}

// ─── Default Mock Responses ─────────────────────────────────────────────────

const BATCH_ID = 'batch-001';

/**
 * The verifyImportBatch function makes 8 sequential db.execute calls.
 * We provide default "clean" responses for each:
 *   1. grievance count → { cnt: 5 }
 *   2. null critical fields → [] (none)
 *   3. orphan documents → [] (none)
 *   4. timeline event count → { cnt: 10 }
 *   5. document count → { cnt: 3 }
 *   6. stuck records → { cnt: 0 }
 *   7. cross-org references → [] (none)
 *   8. batch meta → consistent counts
 */
function setCleanMocks() {
  mocks.mockExecute
    .mockResolvedValueOnce([{ cnt: 5 }])           // §12.1: grievance count
    .mockResolvedValueOnce([])                       // §12.2: null critical (none)
    .mockResolvedValueOnce([])                       // §12.3: orphan docs (none)
    .mockResolvedValueOnce([{ cnt: 10 }])            // §12.4: timeline count
    .mockResolvedValueOnce([{ cnt: 3 }])             // §12.5: doc count
    .mockResolvedValueOnce([{ cnt: 0 }])             // §12.6: stuck records
    .mockResolvedValueOnce([])                       // §12.7: cross-org refs (none)
    .mockResolvedValueOnce([{                        // §12.8: batch meta
      total_records: 5,
      succeeded: 5,
      failed: 0,
      skipped: 0,
      status: 'completed',
    }]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('verifyImportBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockExecute.mockReset();
    mocks.mockExecute.mockImplementation(manifestResponder);
    Object.assign(manifestState, { manifest: 'clean', missingCase: false, evidence: 'verified' });
  });

  it('passes when all checks are clean', async () => {
    setCleanMocks();

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(true);
    expect(result.batchId).toBe(BATCH_ID);
    expect(result.checks.filter(c => c.severity === 'error')).toHaveLength(0);
    expect(result.summary.grievancesImported).toBe(5);
    expect(result.summary.timelineEventsCreated).toBe(10);
    expect(result.summary.documentsLinked).toBe(3);
    expect(result.summary.orphanDocuments).toBe(0);
    expect(result.summary.stuckRecords).toBe(0);
  });

  it('reports null critical fields as error', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([                       // §12.2: null critical
        { id: 'g1', grievance_number: 'GR-001', external_case_id: 'EXT-001' },
      ])
      .mockResolvedValueOnce([])                     // orphan docs
      .mockResolvedValueOnce([{ cnt: 10 }])
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total_records: 5, succeeded: 5, failed: 0, skipped: 0 }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false);
    const nullCheck = result.checks.find(c => c.check === 'null_critical_fields');
    expect(nullCheck).toBeDefined();
    expect(nullCheck!.severity).toBe('error');
    expect(nullCheck!.count).toBe(1);
  });

  it('fails a batch with an orphan document', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([])                     // null critical (clean)
      .mockResolvedValueOnce([                       // §12.3: orphan docs
        { id: 'd1', name: 'orphan.pdf', linked_case_id: 'nonexistent-uuid' },
      ])
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total_records: 3, succeeded: 3, failed: 0, skipped: 0 }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false); // every finding blocks
    const orphanCheck = result.checks.find(c => c.check === 'orphan_documents');
    expect(orphanCheck).toBeDefined();
    expect(orphanCheck!.severity).toBe('error');
    expect(result.summary.orphanDocuments).toBe(1);
  });

  it('fails a batch with a record stuck in processing', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 10 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 20 }])
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([{ cnt: 2 }])           // §12.6: 2 stuck records
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total_records: 10, succeeded: 8, failed: 0, skipped: 0 }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false); // every finding blocks
    const stuckCheck = result.checks.find(c => c.check === 'stuck_records');
    expect(stuckCheck).toBeDefined();
    expect(stuckCheck!.count).toBe(2);
    expect(result.summary.stuckRecords).toBe(2);
  });

  it('reports broken org references as error', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 8 }])
      .mockResolvedValueOnce([{ cnt: 2 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([                       // §12.7: broken org refs
        { id: 'g1', organization_id: 'bad-org-id' },
      ])
      .mockResolvedValueOnce([{ total_records: 5, succeeded: 5, failed: 0, skipped: 0 }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false);
    const orgCheck = result.checks.find(c => c.check === 'broken_org_reference');
    expect(orgCheck).toBeDefined();
    expect(orgCheck!.severity).toBe('error');
  });

  it('fails a batch whose counts do not reconcile', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 10 }])
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{                      // §12.8: mismatched counts
        total_records: 10,
        succeeded: 5,
        failed: 2,
        skipped: 1,   // sum = 8, but total = 10 → mismatch
        status: 'completed',
      }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false); // unreconciled counts block
    const mismatchCheck = result.checks.find(c => c.check === 'batch_count_mismatch');
    expect(mismatchCheck).toBeDefined();
    expect(mismatchCheck!.severity).toBe('error');
  });

  it('handles empty batch gracefully', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 0 }])           // no grievances
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 0 }])           // no timeline events
      .mockResolvedValueOnce([{ cnt: 0 }])           // no documents
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total_records: 0, succeeded: 0, failed: 0, skipped: 0, status: 'completed' }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(true);
    expect(result.summary.grievancesImported).toBe(0);
    expect(result.summary.timelineEventsCreated).toBe(0);
    expect(result.summary.documentsLinked).toBe(0);
  });

  it('fails when the batch record is missing or out of scope', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 6 }])
      .mockResolvedValueOnce([{ cnt: 1 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);                    // no batch meta row

    const result = await verifyImportBatch(BATCH_ID);

    // A batch id with no batch record in scope (unknown, or another organization's under RLS) fails
    expect(result.passed).toBe(false);
    expect(result.checks.find(c => c.check === 'batch_not_found')?.severity).toBe('error');
    expect(result.summary.grievancesImported).toBe(3);
  });

  it('combines multiple issues correctly', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 5 }])
      .mockResolvedValueOnce([                       // null critical
        { id: 'g1', grievance_number: 'GR-001', external_case_id: 'EXT-001' },
      ])
      .mockResolvedValueOnce([                       // orphan docs
        { id: 'd1', name: 'orphan.pdf', linked_case_id: 'missing-id' },
      ])
      .mockResolvedValueOnce([{ cnt: 10 }])
      .mockResolvedValueOnce([{ cnt: 3 }])
      .mockResolvedValueOnce([{ cnt: 1 }])           // stuck
      .mockResolvedValueOnce([                       // broken org
        { id: 'g2', organization_id: 'bad-org' },
      ])
      .mockResolvedValueOnce([{ total_records: 5, succeeded: 3, failed: 1, skipped: 0, status: 'partial' }]); // mismatch

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false); // has errors
    // null_critical + orphan + stuck + broken_org + mismatch + incomplete
    expect(result.checks.map(c => c.check).sort()).toEqual([
      'batch_count_mismatch', 'batch_incomplete', 'broken_org_reference', 'null_critical_fields', 'orphan_documents', 'stuck_records',
    ]);
    expect(result.checks.every(c => c.severity === 'error')).toBe(true);
  });

  it('fails a batch that did not complete, even when its counts reconcile', async () => {
    mocks.mockExecute
      .mockResolvedValueOnce([{ cnt: 4 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ cnt: 8 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([{ cnt: 0 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total_records: 5, succeeded: 4, failed: 1, skipped: 0, status: 'partial' }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false);
    expect(result.checks.map(c => c.check)).toEqual(['batch_incomplete']);
  });

  it('fails a batch with no manifest, an unsealed manifest or no expected source manifest (MIG-07, MIG-11)', async () => {
    for (const [state, check] of [['absent', 'batch_manifest_missing'], ['unsealed', 'batch_manifest_unsealed'], ['no-source', 'source_manifest_missing']] as const) {
      mocks.mockExecute.mockReset();
      mocks.mockExecute.mockImplementation(manifestResponder);
      manifestState.manifest = state;
      setCleanMocks();
      const result = await verifyImportBatch(BATCH_ID);
      expect(result.passed, state).toBe(false);
      expect(result.checks.map((c) => c.check), state).toContain(check);
    }
  });

  it('fails a batch that does not reconcile with its source manifest (MIG-07)', async () => {
    manifestState.missingCase = true;
    setCleanMocks();
    const result = await verifyImportBatch(BATCH_ID);
    expect(result.passed).toBe(false);
    expect(result.checks.find((c) => c.check === 'source_manifest_missing_cases')).toMatchObject({ count: 1, details: ['C-2'] });
  });

  it('never passes a document that is only a reference or whose bytes did not match (MIG-05)', async () => {
    for (const [state, check] of [['reference', 'document_content_unverified'], ['mismatch', 'document_digest_mismatch']] as const) {
      mocks.mockExecute.mockReset();
      mocks.mockExecute.mockImplementation(manifestResponder);
      manifestState.evidence = state;
      setCleanMocks();
      const result = await verifyImportBatch(BATCH_ID);
      expect(result.passed, state).toBe(false);
      expect(result.checks.find((c) => c.check === check), state).toMatchObject({ severity: 'error', count: 3 });
      expect(result.summary.documentsContentVerified).toBe(0);
    }
  });
});
