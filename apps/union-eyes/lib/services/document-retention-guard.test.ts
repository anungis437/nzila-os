import { describe, expect, it } from 'vitest';
import { getDocumentMutabilityBlockReason } from '@/lib/services/document-retention-guard';

describe('document-retention-guard', () => {
  it('blocks when legal hold is active', () => {
    const reason = getDocumentMutabilityBlockReason({
      metadata: { legalHoldActive: true },
    });

    expect(reason).toBe('Document is under legal hold');
  });

  it('blocks when nested legal hold metadata is active', () => {
    const reason = getDocumentMutabilityBlockReason({
      metadata: { legalHold: { active: true, matterId: 'liuna-synthetic-matter' } },
    });

    expect(reason).toBe('Document is under legal hold');
  });

  it('blocks when retentionUntil is in the future', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const reason = getDocumentMutabilityBlockReason({
      metadata: { retentionUntil: future },
    });

    expect(reason).toContain('Document is retained until');
  });

  it('blocks when nested retention metadata has a future until date', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    const reason = getDocumentMutabilityBlockReason(
      {
        metadata: { retention: { until: '2026-09-01T00:00:00.000Z' } },
      },
      now,
    );

    expect(reason).toBe('Document is retained until 2026-09-01T00:00:00.000Z');
  });

  it('allows mutation when no hold/retention blocks exist', () => {
    const reason = getDocumentMutabilityBlockReason({
      metadata: { retentionUntil: '2020-01-01T00:00:00.000Z' },
    });

    expect(reason).toBeNull();
  });
});
