/**
 * Tests for Ingestion Validation Pipeline (§11)
 *
 * Covers:
 * - Required field validation
 * - FSM state mapping
 * - Duplicate detection within batch
 * - Date validation
 * - Fingerprint computation
 * - Timeline event hashing
 */

import { describe, it, expect } from 'vitest';
import {
  validateIngestionBatch,
  computeRecordFingerprint,
  computeTimelineEventHash,
  mapImportStatus,
  type IngestionGrievanceRecord,
} from '../validation-pipeline';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<IngestionGrievanceRecord> = {}): IngestionGrievanceRecord {
  return {
    external_case_id: 'EXT-001',
    type: 'contract',
    status: 'filed',
    title: 'Wage dispute for Q4 bonuses',
    description: 'Employee claims unpaid bonus for Q4 2025',
    organization_id: '00000000-0000-4000-a000-000000000001',
    filed_date: '2025-10-15',
    ...overrides,
  };
}

// ─── §11: Validation Pipeline ───────────────────────────────────────────────

describe('validateIngestionBatch', () => {
  it('accepts a valid batch', () => {
    const result = validateIngestionBatch([makeRecord()]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.recordCount).toBe(1);
  });

  it('rejects empty batch', () => {
    const result = validateIngestionBatch([]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Empty');
  });

  it('rejects missing external_case_id', () => {
    const result = validateIngestionBatch([makeRecord({ external_case_id: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'external_case_id')).toBe(true);
  });

  it('rejects missing title', () => {
    const result = validateIngestionBatch([makeRecord({ title: '' })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'title')).toBe(true);
  });

  it('rejects missing description', () => {
    const result = validateIngestionBatch([makeRecord({ description: '' })]);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid grievance type', () => {
    const result = validateIngestionBatch([makeRecord({ type: 'invalid_type' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid grievance type');
  });

  it('rejects unmappable status', () => {
    const result = validateIngestionBatch([makeRecord({ status: 'totally_unknown_xyz' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Cannot map status');
  });

  it('rejects a status that a grievance status column cannot hold, with the reason', () => {
    const result = validateIngestionBatch([makeRecord({ status: 'pending_documentation' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("stored as 'pending_documentation'");
    expect(result.errors[0].message).toContain('20 characters');
  });

  it('detects duplicate external_case_id within batch', () => {
    const rec = makeRecord();
    const result = validateIngestionBatch([rec, { ...rec }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Duplicate external_case_id'))).toBe(true);
  });

  it('refuses an unknown priority instead of defaulting it, and accepts it once explicitly mapped (MIG-02)', () => {
    const refused = validateIngestionBatch([makeRecord({ priority: 'super_high' })]);
    expect(refused.valid).toBe(false);
    expect(refused.errors.find(e => e.field === 'priority')?.message).toContain("Unknown priority 'super_high'");
    expect(validateIngestionBatch([makeRecord({ priority: 'super_high' })], { priority: { super_high: 'urgent' } }).valid).toBe(true);
    // A mapping to a value the platform does not have is itself refused.
    expect(validateIngestionBatch([makeRecord({ priority: 'super_high' })], { priority: { super_high: 'critical' } }).valid).toBe(false);
  });

  it('maps an unknown stage only through an explicit mapping', () => {
    expect(validateIngestionBatch([makeRecord({ step: 'stage-two' })], { step: { 'stage-two': 'step_2' } }).valid).toBe(true);
  });

  it('refuses a declared document digest that is not a SHA-256', () => {
    const result = validateIngestionBatch([makeRecord({ documents: [{ name: 'a.pdf', sha256: 'abc' }] })]);
    expect(result.errors.find(e => e.field === 'documents[0].sha256')).toBeDefined();
  });

  it('refuses an unknown procedural stage instead of dropping it', () => {
    const result = validateIngestionBatch([makeRecord({ step: 'step_99' })]);
    expect(result.valid).toBe(false);
    const issue = result.errors.find(e => e.field === 'step');
    expect(issue?.message).toContain("Unknown procedural stage 'step_99'");
    expect(result.warnings.some(w => w.field === 'step')).toBe(false);
  });

  it('refuses a record without a historical filed date (the import date is never substituted)', () => {
    for (const filed_date of [undefined, '', '   ']) {
      const result = validateIngestionBatch([makeRecord({ filed_date })]);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'filed_date' && e.message.includes('never substituted'))).toBe(true);
    }
  });

  it('rejects invalid date format', () => {
    const result = validateIngestionBatch([makeRecord({ incident_date: 'not-a-date' })]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain('Invalid date format');
  });

  it('warns on future dates', () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const result = validateIngestionBatch([makeRecord({ incident_date: future })]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.message.includes('future'))).toBe(true);
  });

  it('warns on missing grievant name', () => {
    const result = validateIngestionBatch([makeRecord({ grievant_name: undefined, filed_by: undefined })]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.field === 'grievant_name')).toBe(true);
  });

  it('refuses a timeline event without a date of its own', () => {
    const result = validateIngestionBatch([makeRecord({
      timeline: [{ date: '', action: 'filed', actor: 'Jane' }],
    })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'timeline[0].date')).toBe(true);
  });

  it('refuses a timeline event with an unparseable date', () => {
    const result = validateIngestionBatch([makeRecord({
      timeline: [{ date: 'sometime in spring', action: 'filed', actor: 'Jane' }],
    })]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'timeline[0].date' && e.message.includes('Invalid timeline date'))).toBe(true);
  });

  it('warns on missing timeline action', () => {
    const result = validateIngestionBatch([makeRecord({
      timeline: [{ date: '2025-01-01', action: '', actor: 'Jane' }],
    })]);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.field.includes('timeline'))).toBe(true);
  });

  it('validates multiple records independently', () => {
    const records = [
      makeRecord({ external_case_id: 'A' }),
      makeRecord({ external_case_id: 'B', type: 'INVALID' }),
      makeRecord({ external_case_id: 'C' }),
    ];
    const result = validateIngestionBatch(records);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].index).toBe(1);
    expect(result.recordCount).toBe(3);
  });
});

// ─── §1: Idempotency — Fingerprint ─────────────────────────────────────────

describe('computeRecordFingerprint', () => {
  it('produces consistent hashes for same input', () => {
    const rec = makeRecord();
    expect(computeRecordFingerprint(rec)).toBe(computeRecordFingerprint(rec));
  });

  it('produces different hashes for different external_case_id', () => {
    const a = computeRecordFingerprint(makeRecord({ external_case_id: 'A' }));
    const b = computeRecordFingerprint(makeRecord({ external_case_id: 'B' }));
    expect(a).not.toBe(b);
  });

  it('returns 64-char hex string (SHA-256)', () => {
    const hash = computeRecordFingerprint(makeRecord());
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── §5: Timeline Event Hash Dedup ──────────────────────────────────────────

describe('computeTimelineEventHash', () => {
  it('produces consistent hashes', () => {
    const ev = { date: '2025-06-01', action: 'filed', actor: 'John', notes: 'Initial filing' };
    expect(computeTimelineEventHash(ev)).toBe(computeTimelineEventHash(ev));
  });

  it('different actions produce different hashes', () => {
    const a = computeTimelineEventHash({ date: '2025-06-01', action: 'filed' });
    const b = computeTimelineEventHash({ date: '2025-06-01', action: 'acknowledged' });
    expect(a).not.toBe(b);
  });

  it('handles missing optional fields', () => {
    const hash = computeTimelineEventHash({ date: '2025-06-01', action: 'filed' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── §4: FSM Status Mapping ────────────────────────────────────────────────

describe('mapImportStatus', () => {
  it('maps direct grievance statuses', () => {
    expect(mapImportStatus('filed').grievanceStatus).toBe('filed');
    expect(mapImportStatus('investigating').grievanceStatus).toBe('investigating');
    expect(mapImportStatus('settled').grievanceStatus).toBe('settled');
  });

  it('maps aliases', () => {
    expect(mapImportStatus('open').grievanceStatus).toBe('filed');
    expect(mapImportStatus('new').grievanceStatus).toBe('filed');
    expect(mapImportStatus('active').grievanceStatus).toBe('investigating');
    expect(mapImportStatus('complete').grievanceStatus).toBe('resolved');
    expect(mapImportStatus('cancelled').grievanceStatus).toBe('withdrawn');
    expect(mapImportStatus('rejected').grievanceStatus).toBe('rejected');
  });

  it('normalizes whitespace and case', () => {
    expect(mapImportStatus('  FILED  ').grievanceStatus).toBe('filed');
    expect(mapImportStatus('Under Review').grievanceStatus).toBe('under_review');
  });

  it('returns null lifecycle for unmappable status', () => {
    expect(mapImportStatus('totally_unknown_xyz').lifecycleState).toBeNull();
  });

  it('returns lifecycle state for known statuses', () => {
    const result = mapImportStatus('filed');
    expect(result.lifecycleState).not.toBeNull();
  });
});

describe('exact record and event digests (MIG-09)', () => {
  it('distinguishes records that differ only past the old 500-character description prefix, or in status, priority, timeline or documents', async () => {
    const { computeRecordFingerprint } = await import('../validation-pipeline');
    const long = 'x'.repeat(600);
    const base = makeRecord({ description: long });
    const variants = [
      makeRecord({ description: long.slice(0, 599) + 'y' }),
      makeRecord({ description: long, status: 'closed' }),
      makeRecord({ description: long, priority: 'low' }),
      makeRecord({ description: long, timeline: [{ date: '2026-01-02', action: 'x' }] }),
      makeRecord({ description: long, documents: [{ name: 'a.pdf', sha256: 'a'.repeat(64) }] }),
    ];
    const fingerprints = new Set([base, ...variants].map(computeRecordFingerprint));
    expect(fingerprints.size).toBe(variants.length + 1);
    expect(computeRecordFingerprint(base)).toBe(computeRecordFingerprint(makeRecord({ description: long })));
  });

  it('hashes timeline notes in full, and keeps the earlier bytes for notes of 200 characters or fewer', async () => {
    const { computeTimelineEventHash } = await import('../validation-pipeline');
    const { createHash } = await import('crypto');
    const prefix = 'n'.repeat(200);
    expect(computeTimelineEventHash({ date: 'd', action: 'a', notes: prefix + '1' })).not.toBe(computeTimelineEventHash({ date: 'd', action: 'a', notes: prefix + '2' }));
    const earlier = createHash('sha256').update(JSON.stringify({ d: 'd', a: 'a', actor: '', n: 'short note' })).digest('hex');
    expect(computeTimelineEventHash({ date: 'd', action: 'a', notes: 'short note' })).toBe(earlier);
  });
});
