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
    }]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('verifyImportBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('reports orphan documents as warning', async () => {
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

    expect(result.passed).toBe(true); // warnings don't fail
    const orphanCheck = result.checks.find(c => c.check === 'orphan_documents');
    expect(orphanCheck).toBeDefined();
    expect(orphanCheck!.severity).toBe('warning');
    expect(result.summary.orphanDocuments).toBe(1);
  });

  it('reports stuck records as warning', async () => {
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

    expect(result.passed).toBe(true); // warnings don't fail
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

  it('warns on batch count mismatch', async () => {
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
      }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(true); // mismatch is a warning
    const mismatchCheck = result.checks.find(c => c.check === 'batch_count_mismatch');
    expect(mismatchCheck).toBeDefined();
    expect(mismatchCheck!.severity).toBe('warning');
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
      .mockResolvedValueOnce([{ total_records: 0, succeeded: 0, failed: 0, skipped: 0 }]);

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(true);
    expect(result.summary.grievancesImported).toBe(0);
    expect(result.summary.timelineEventsCreated).toBe(0);
    expect(result.summary.documentsLinked).toBe(0);
  });

  it('handles missing batch meta record', async () => {
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

    // Should still pass — missing meta just skips that check
    expect(result.passed).toBe(true);
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
      .mockResolvedValueOnce([{ total_records: 5, succeeded: 3, failed: 1, skipped: 0 }]); // mismatch

    const result = await verifyImportBatch(BATCH_ID);

    expect(result.passed).toBe(false); // has errors
    expect(result.checks.length).toBe(5); // null_critical + orphan + stuck + broken_org + mismatch
    const errors = result.checks.filter(c => c.severity === 'error');
    const warnings = result.checks.filter(c => c.severity === 'warning');
    expect(errors.length).toBe(2);   // null_critical + broken_org
    expect(warnings.length).toBe(3); // orphan + stuck + mismatch
  });
});
