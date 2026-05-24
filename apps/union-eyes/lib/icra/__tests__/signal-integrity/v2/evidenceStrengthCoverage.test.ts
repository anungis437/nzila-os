/**
 * v2 Foundation — Evidence-Strength Coverage
 *
 * Validates the evidence ladder + branching engine + declared-vs-evidenced
 * gap function. Asserts ladder totalness, branching monotonicity, and
 * non-negative gap computation.
 */
import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_LEVELS,
  EVIDENCE_LEVEL_ORDER,
  evidenceContribution,
  isAtLeast,
  type EvidenceLevel,
} from '../../../evidence-strength/evidenceTaxonomy';
import {
  declaredVsEvidencedGap,
  resolveBranching,
} from '../../../evidence-strength/evidenceBranchingEngine';

describe('v2 Foundation — evidence-strength coverage', () => {
  it('evidence ladder has all six canonical levels in monotonic order', () => {
    const ordinals = EVIDENCE_LEVEL_ORDER.map((l) => EVIDENCE_LEVELS[l].ordinal);
    expect(ordinals).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('isAtLeast respects ordering for every pair of levels', () => {
    for (const a of EVIDENCE_LEVEL_ORDER) {
      for (const b of EVIDENCE_LEVEL_ORDER) {
        const expected = EVIDENCE_LEVELS[a].ordinal >= EVIDENCE_LEVELS[b].ordinal;
        expect(isAtLeast(a, b)).toBe(expected);
      }
    }
  });

  it('contribution increases monotonically across the ladder', () => {
    let prev = -1;
    for (const level of EVIDENCE_LEVEL_ORDER) {
      const c = evidenceContribution(level);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it('branching engine is monotonic — higher claims include lower follow-ups', () => {
    const rules = [
      { minLevel: 'DOCUMENTED' as EvidenceLevel, enables: ['q_doc'] },
      { minLevel: 'OPERATIONAL' as EvidenceLevel, enables: ['q_ops'] },
      { minLevel: 'VERIFIED' as EvidenceLevel, enables: ['q_verified'] },
    ];
    expect(resolveBranching('VERBAL', rules)).toEqual([]);
    expect(resolveBranching('DOCUMENTED', rules)).toEqual(['q_doc']);
    expect(resolveBranching('OPERATIONAL', rules).sort()).toEqual(['q_doc', 'q_ops']);
    expect(resolveBranching('CROSS_VALIDATED', rules).sort()).toEqual([
      'q_doc',
      'q_ops',
      'q_verified',
    ]);
  });

  it('declared-vs-evidenced gap is zero when evidence matches declaration', () => {
    for (const level of EVIDENCE_LEVEL_ORDER) {
      expect(declaredVsEvidencedGap(level, level)).toBe(0);
    }
  });

  it('declared-vs-evidenced gap is positive when declaration exceeds evidence', () => {
    expect(declaredVsEvidencedGap('CROSS_VALIDATED', 'NONE')).toBe(1);
    expect(declaredVsEvidencedGap('VERIFIED', 'DOCUMENTED')).toBeGreaterThan(0);
  });

  it('declared-vs-evidenced gap is non-negative when evidence exceeds declaration', () => {
    expect(declaredVsEvidencedGap('VERBAL', 'OPERATIONAL')).toBe(0);
  });
});
