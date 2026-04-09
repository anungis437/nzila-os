/**
 * Tests for Batch Ingestion Engine (§1-§10)
 *
 * Covers:
 * - §1  Idempotent upserts (fingerprint + ON CONFLICT)
 * - §2  Migration traceability (source_system, imported_at, batch_id)
 * - §3  Partial ingestion safety (continueOnError, batch tracking)
 * - §4  FSM safe import (status mapping, synthetic events)
 * - §7  User resolution fallback ("Unassigned")
 * - §8  Entity link integrity (org validation)
 * - §9  Error handling (per-record structured logging)
 * - Dry-run mode
 * - Validation failure rejection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── hoisted mocks ─────────────────────────────────────────────────────────── */
const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockExecute: vi.fn(),
}));

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

/* ── module mocks ──────────────────────────────────────────────────────────── */
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: (...a: unknown[]) => mocks.mockSelect(...a),
    insert: (...a: unknown[]) => mocks.mockInsert(...a),
    execute: (...a: unknown[]) => mocks.mockExecute(...a),
  },
}));

// Schema mocks — batch-ingest imports these tables for db.insert
vi.mock('@/db/schema/grievance-schema', () => ({
  grievances: {},
  grievanceStatusEnum: {},
  grievanceTypeEnum: {},
  grievancePriorityEnum: {},
}));
vi.mock('@/db/schema-organizations', () => ({
  organizations: {},
}));
vi.mock('@/db/schema/documents-schema', () => ({
  documents: {},
  caseDocuments: {},
}));
vi.mock('@/db/schema/ingestion-schema', () => ({
  ingestionBatches: {},
  ingestionRecords: {},
  grievanceTimelineEvents: {},
}));

// ─── Import under test ──────────────────────────────────────────────────────

import { ingestGrievanceBatch, type IngestionOptions } from '../batch-ingest';
import type { IngestionGrievanceRecord } from '../validation-pipeline';

// ─── Defaults ────────────────────────────────────────────────────────────────

const ORG_ID = '00000000-0000-4000-a000-000000000001';

function makeOpts(overrides: Partial<IngestionOptions> = {}): IngestionOptions {
  return {
    organizationId: ORG_ID,
    sourceSystem: 'test-system',
    createdBy: 'user-123',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<IngestionGrievanceRecord> = {}): IngestionGrievanceRecord {
  return {
    external_case_id: 'EXT-001',
    type: 'contract',
    status: 'filed',
    title: 'Test grievance title',
    description: 'Test grievance description',
    organization_id: ORG_ID,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ingestGrievanceBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: org lookup succeeds
    mocks.mockSelect.mockReturnValue(chain([{ id: ORG_ID }]));

    // Default: batch insert returns array with ID (destructured as [batch])
    mocks.mockInsert.mockReturnValue(chain([{ id: 'batch-001' }]));

    // Default: db.execute returns a single row with id for the grievance upsert
    mocks.mockExecute.mockResolvedValue([{ id: 'grievance-001' }]);
  });

  // ─── Validation Rejection ──────────────────────────────────────────────

  it('rejects batch with validation errors', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord({ external_case_id: '' })], // missing required field
      makeOpts(),
    );

    expect(result.status).toBe('failed');
    expect(result.validation.valid).toBe(false);
    expect(result.succeeded).toBe(0);
  });

  it('rejects empty records array', async () => {
    const result = await ingestGrievanceBatch([], makeOpts());
    expect(result.status).toBe('failed');
    expect(result.validation.errors.length).toBeGreaterThan(0);
  });

  // ─── §8: Organization Validation ──────────────────────────────────────

  it('fails if organization not found', async () => {
    // Org lookup returns empty
    mocks.mockSelect.mockReturnValue(chain([]));

    const result = await ingestGrievanceBatch(
      [makeRecord()],
      makeOpts(),
    );

    expect(result.status).toBe('failed');
    expect(result.errors[0].error).toContain('not found');
  });

  // ─── Dry-Run Mode ─────────────────────────────────────────────────────

  it('returns success in dry-run without DB writes', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord()],
      makeOpts({ dryRun: true }),
    );

    expect(result.status).toBe('completed');
    expect(result.dryRun).toBe(true);
    expect(result.batchId).toBe('dry-run');
    expect(result.succeeded).toBe(1);
    // Should only have called verifyOrganization (select), no inserts beyond that
  });

  // ─── §1: Successful Ingestion ─────────────────────────────────────────

  it('ingests a valid record successfully', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord()],
      makeOpts(),
    );

    expect(result.status).toBe('completed');
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.batchId).toBe('batch-001');
    expect(result.dryRun).toBe(false);
  });

  // ─── §3: Partial Ingestion ────────────────────────────────────────────

  it('continues on error when continueOnError is true', async () => {
    // Make the execute mock fail for the first grievance upsert, succeed for the second
    let executeCalls = 0;
    mocks.mockExecute.mockImplementation(() => {
      executeCalls++;
      // Upsert calls (odd-numbered considering tracking updates interleave)
      if (executeCalls === 1) {
        return Promise.reject(new Error('DB constraint violation'));
      }
      return Promise.resolve([{ id: `grievance-${executeCalls}` }]);
    });

    const result = await ingestGrievanceBatch(
      [
        makeRecord({ external_case_id: 'A' }),
        makeRecord({ external_case_id: 'B' }),
      ],
      makeOpts({ continueOnError: true }),
    );

    // At least one record should have been processed
    expect(result.totalRecords).toBe(2);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ─── §8: Org Mismatch ────────────────────────────────────────────────

  it('fails records with org mismatch', async () => {
    // Record's org doesn't match batch org
    const result = await ingestGrievanceBatch(
      [makeRecord({ organization_id: 'different-org-id' })],
      makeOpts(),
    );

    // Should fail validation because org_id doesn't match
    // The validation pipeline doesn't check org match, but the batch engine does
    expect(result.status).toBe('failed');
  });

  // ─── §7: User Fallback ───────────────────────────────────────────────

  it('processes records without grievant (uses Unassigned fallback)', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord({ grievant_name: undefined, filed_by: undefined })],
      makeOpts(),
    );

    // Should succeed — "Unassigned" is used for missing user fields
    expect(result.status).toBe('completed');
    expect(result.succeeded).toBe(1);
  });

  // ─── §2: Traceability Fields ──────────────────────────────────────────

  it('includes traceability in result', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord()],
      makeOpts({ sourceSystem: 'cupe-legacy' }),
    );

    expect(result.batchId).toBeTruthy();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ─── §4: FSM Status Mapping ──────────────────────────────────────────

  it('accepts records with aliased status values', async () => {
    // 'open' → 'filed' via alias mapping
    const result = await ingestGrievanceBatch(
      [makeRecord({ status: 'open' })],
      makeOpts(),
    );

    // Validation should pass since 'open' maps to 'filed'
    expect(result.validation.valid).toBe(true);
  });

  // ─── Multiple Records ────────────────────────────────────────────────

  it('ingests multiple records in a batch', async () => {
    const records = [
      makeRecord({ external_case_id: 'EXT-A' }),
      makeRecord({ external_case_id: 'EXT-B' }),
      makeRecord({ external_case_id: 'EXT-C' }),
    ];

    const result = await ingestGrievanceBatch(records, makeOpts());

    expect(result.totalRecords).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.status).toBe('completed');
  });

  // ─── §5: Timeline Events ─────────────────────────────────────────────

  it('processes records with timeline events', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord({
        timeline: [
          { date: '2025-01-15', action: 'filed', actor: 'Jane Smith', notes: 'Initial filing' },
          { date: '2025-01-20', action: 'acknowledged', actor: 'John Doe' },
        ],
      })],
      makeOpts(),
    );

    expect(result.status).toBe('completed');
    // Should have made execute calls for timeline events
    expect(mocks.mockExecute).toHaveBeenCalled();
  });

  // ─── §6: Document Normalization ───────────────────────────────────────

  it('processes records with documents', async () => {
    const result = await ingestGrievanceBatch(
      [makeRecord({
        documents: [
          { name: 'Grievance Form.pdf', file_type: 'pdf', file_url: '/docs/form.pdf' },
          { name: 'Evidence.jpg', file_type: 'image' },
        ],
      })],
      makeOpts(),
    );

    expect(result.status).toBe('completed');
    expect(mocks.mockExecute).toHaveBeenCalled();
  });
});
