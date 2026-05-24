import { describe, expect, it } from 'vitest';
import { buildEntropyAuditPacket } from '../entropyAuditPacketBuilder';
import type { EvidenceObservation } from '../entropyAuditContracts';

const o = (source: string, conf: number): EvidenceObservation => ({
  evidenceType: 'Documentary',
  evidenceStrength: 'strong',
  evidenceSource: source,
  evidenceConfidence: conf,
  reviewerConfidence: 0.9,
});

describe('entropyAuditPacketBuilder', () => {
  it('builds a packet with a stable hash for identical inputs', () => {
    const a = buildEntropyAuditPacket({
      entropyOrdinal: 3,
      observations: [o('src-a', 0.8), o('src-b', 0.9)],
      failedCriteria: ['no documented successor', 'no delegation register'],
      envelopeConfidence: 'MODERATE',
    });
    const b = buildEntropyAuditPacket({
      entropyOrdinal: 3,
      observations: [o('src-b', 0.9), o('src-a', 0.8)], // reordered
      failedCriteria: ['no delegation register', 'no documented successor'], // reordered
      envelopeConfidence: 'MODERATE',
    });
    expect(a.reproducibilityHash).toBe(b.reproducibilityHash);
  });

  it('different observations yield different hashes', () => {
    const a = buildEntropyAuditPacket({
      entropyOrdinal: 3,
      observations: [o('src-a', 0.8)],
      failedCriteria: [],
      envelopeConfidence: 'MODERATE',
    });
    const b = buildEntropyAuditPacket({
      entropyOrdinal: 3,
      observations: [o('src-a', 0.9)],
      failedCriteria: [],
      envelopeConfidence: 'MODERATE',
    });
    expect(a.reproducibilityHash).not.toBe(b.reproducibilityHash);
  });

  it('escalates when envelope confidence is INSUFFICIENT', () => {
    const p = buildEntropyAuditPacket({
      entropyOrdinal: 2,
      observations: [o('src-a', 0.8)],
      failedCriteria: ['governance documentation absent'],
      envelopeConfidence: 'INSUFFICIENT',
    });
    expect(p.escalationFlags.length).toBeGreaterThan(0);
    expect(p.escalationFlags[0]).toContain('urgent');
  });

  it('packet is frozen', () => {
    const p = buildEntropyAuditPacket({
      entropyOrdinal: 1,
      observations: [],
      failedCriteria: [],
      envelopeConfidence: 'INSUFFICIENT',
    });
    expect(Object.isFrozen(p)).toBe(true);
    expect(Object.isFrozen(p.observedEvidence)).toBe(true);
  });
});
