import { describe, expect, it } from 'vitest';
import { evaluateEvidenceSufficiency } from '../evidenceSufficiencyEngine';
import type { EvidenceObservation } from '../entropyAuditContracts';

const obs = (
  evidenceType: EvidenceObservation['evidenceType'],
  evidenceStrength: EvidenceObservation['evidenceStrength'],
  evidenceConfidence: number,
  reviewerConfidence: number,
  evidenceSource = 'reviewer-1',
): EvidenceObservation => ({
  evidenceType,
  evidenceStrength,
  evidenceConfidence,
  reviewerConfidence,
  evidenceSource,
});

describe('evidenceSufficiencyEngine', () => {
  it('fails cautiously with zero observations', () => {
    const r = evaluateEvidenceSufficiency([]);
    expect(r.sufficiency).toBe('insufficient');
    expect(r.escalationRequired).toBe(true);
    expect(r.confidence).toBe('low');
  });

  it('returns sufficient on multiple strong observations', () => {
    const r = evaluateEvidenceSufficiency([
      obs('Documentary', 'strong', 1, 1),
      obs('Governance', 'strong', 1, 1),
      obs('CrossFunctional', 'strong', 1, 1),
    ]);
    expect(r.sufficiency).toBe('sufficient');
    expect(r.confidence).toBe('high');
    expect(r.escalationRequired).toBe(false);
  });

  it('downgrades sufficient to partial when contradictions detected', () => {
    const r = evaluateEvidenceSufficiency([
      obs('Documentary', 'strong', 0.9, 1),
      obs('Governance', 'strong', 0.9, 1),
      obs('CrossFunctional', 'strong', 0.9, 1),
      obs('Operational', 'strong', 0.1, 1), // strong counter
    ]);
    expect(r.contradictionsDetected).toBe(true);
    expect(r.sufficiency).not.toBe('sufficient');
    expect(r.escalationRequired).toBe(true);
  });

  it('verbal-only evidence is never sufficient', () => {
    const r = evaluateEvidenceSufficiency([
      obs('Verbal', 'strong', 1, 1),
      obs('Verbal', 'strong', 1, 1),
      obs('Verbal', 'strong', 1, 1),
    ]);
    expect(r.sufficiency).not.toBe('sufficient');
  });

  it('result and rationale are frozen', () => {
    const r = evaluateEvidenceSufficiency([obs('Documentary', 'weak', 0.5, 0.5)]);
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.rationale)).toBe(true);
  });
});
