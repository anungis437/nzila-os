/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (T3)
 * MODULE: Every surfaced finding has all seven answers
 * SPEC: docs/oci/government-readiness/implementation/NON_REGRESSION_TEST_SPECIFICATION.md §T3
 *
 * No finding is surfaced unless evidence, statement, obligation, dimension
 * contribution, confidence, consequence, and ≥1 recommendation are all present.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import { deriveFindings, type EvidenceInputs } from '../../findings/findingDerivation';
import { isComplete } from '../../findings/finding';

const FULL_EVIDENCE: EvidenceInputs = {
  evidenceByTheme: {
    undocumented_succession_authority: 'DOCUMENTED',
    single_point_operational_dependency: 'VERBAL',
    board_oversight_gap: 'DOCUMENTED',
    institutional_memory_concentration: 'OPERATIONAL',
    no_continuity_plan: 'DOCUMENTED',
    records_retention_gap: 'OPERATIONAL',
    missing_delegation_instrument: 'DOCUMENTED',
  },
};

describe('T3 — every surfaced finding has all seven answers', () => {
  it('all surfaced findings satisfy the seven-answer contract', () => {
    // Low posture so findings trigger across sections.
    const { trace } = scoreAssessment('seven-answers', buildUniformAnswers(0));
    const findings = deriveFindings(trace, FULL_EVIDENCE);

    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(isComplete(f)).toBe(true);
      expect(f.evidenceLevel).toBeTruthy();
      expect(f.statement.trim().length).toBeGreaterThan(0);
      expect(f.obligationClasses.length).toBeGreaterThanOrEqual(1);
      expect(f.affectedDimensions.length).toBeGreaterThanOrEqual(1);
      expect(f.affectedDimensions.every((d) => typeof d.contribution === 'number')).toBe(true);
      expect(f.confidence).toBeTruthy();
      expect(f.confidence.confidenceRationale.length).toBeGreaterThan(0);
      expect(['asserted', 'potential', 'not_asserted']).toContain(f.consequence.assertion);
      expect(f.recommendationRefs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('findings without reviewer evidence are suppressed, never surfaced partial', () => {
    const { trace } = scoreAssessment('no-evidence', buildUniformAnswers(0));
    const findings = deriveFindings(trace, { evidenceByTheme: {} });
    expect(findings).toStrictEqual([]);
  });

  it('NONE evidence cannot surface a finding (no admissible obligation)', () => {
    const { trace } = scoreAssessment('none-evidence', buildUniformAnswers(0));
    const findings = deriveFindings(trace, {
      evidenceByTheme: {
        undocumented_succession_authority: 'NONE',
        single_point_operational_dependency: 'NONE',
      },
    });
    expect(findings).toStrictEqual([]);
  });

  it('statements contain no obvious PII markers', () => {
    const { trace } = scoreAssessment('pii', buildUniformAnswers(0));
    const findings = deriveFindings(trace, FULL_EVIDENCE);
    for (const f of findings) {
      expect(f.statement).not.toMatch(/@|\bMr\.|\bMrs\.|\bemail\b/i);
    }
  });

  it('derivation is deterministic (run twice, identical)', () => {
    const { trace } = scoreAssessment('determinism', buildUniformAnswers(0));
    expect(deriveFindings(trace, FULL_EVIDENCE)).toStrictEqual(
      deriveFindings(trace, FULL_EVIDENCE),
    );
  });
});
