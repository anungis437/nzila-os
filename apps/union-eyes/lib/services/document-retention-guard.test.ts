import { describe, expect, it } from 'vitest';
import { getDocumentMutabilityBlockReason } from '@/lib/services/document-retention-guard';

describe('document-retention-guard', () => {
  it('blocks when legal hold is active', () => {
    const reason = getDocumentMutabilityBlockReason({
      metadata: { legalHoldActive: true },
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

  it('allows mutation when no hold/retention blocks exist', () => {
    const reason = getDocumentMutabilityBlockReason({
      metadata: { retentionUntil: '2020-01-01T00:00:00.000Z' },
    });

    expect(reason).toBeNull();
  });
});
