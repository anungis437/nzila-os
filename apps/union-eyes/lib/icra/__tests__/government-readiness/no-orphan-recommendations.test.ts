/**
 * ARTIFACT TYPE: Vitest Suite — Government-Readiness Non-Regression (T4)
 * MODULE: No orphan recommendations
 * SPEC: docs/oci/superseded/government-readiness/implementation/NON_REGRESSION_TEST_SPECIFICATION.md §T4
 *
 * Every recommendation surfaced through the traceability record must resolve to
 * at least one finding. The chain must be intact before a report renders.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import { deriveFindings, type EvidenceInputs } from '../../findings/findingDerivation';
import {
  buildTraceabilityRecord,
  recommendationsWithFinding,
} from '../../traceability/traceabilityRecord';

const EVIDENCE: EvidenceInputs = {
  evidenceByTheme: {
    undocumented_succession_authority: 'DOCUMENTED',
    board_oversight_gap: 'DOCUMENTED',
    no_continuity_plan: 'DOCUMENTED',
    records_retention_gap: 'OPERATIONAL',
    missing_delegation_instrument: 'DOCUMENTED',
    institutional_memory_concentration: 'OPERATIONAL',
  },
};

describe('T4 — no orphan recommendations', () => {
  it('every recommendation resolves to at least one finding', () => {
    const { trace } = scoreAssessment('orphans', buildUniformAnswers(0));
    const findings = deriveFindings(trace, EVIDENCE);
    const record = buildTraceabilityRecord('orphans', trace, findings);

    const backed = recommendationsWithFinding(findings);
    for (const ref of backed) {
      const supporting = findings.filter((f) => f.recommendationRefs.includes(ref));
      expect(supporting.length).toBeGreaterThanOrEqual(1);
    }
    expect(record.chainIntegrity.everyRecommendationHasFinding).toBe(true);
  });

  it('chain integrity is intact for a well-formed record', () => {
    const { trace } = scoreAssessment('intact', buildUniformAnswers(0));
    const findings = deriveFindings(trace, EVIDENCE);
    const record = buildTraceabilityRecord('intact', trace, findings);

    expect(record.chainIntegrity.everyFindingHasEvidence).toBe(true);
    expect(record.chainIntegrity.everyFindingHasConfidence).toBe(true);
    expect(record.chainIntegrity.everyFindingHasObligation).toBe(true);
    expect(record.chainIntegrity.intact).toBe(true);
  });

  it('an empty finding set produces a vacuously-intact, renderable record', () => {
    const { trace } = scoreAssessment('empty', buildUniformAnswers(4));
    const record = buildTraceabilityRecord('empty', trace, []);
    expect(record.findings).toStrictEqual([]);
    expect(record.chainIntegrity.intact).toBe(true);
  });

  it('record is version-pinned for audit reproducibility', () => {
    const { trace } = scoreAssessment('versioned', buildUniformAnswers(0));
    const findings = deriveFindings(trace, EVIDENCE);
    const record = buildTraceabilityRecord('versioned', trace, findings);
    expect(record.scoringVersion).toBe(trace.scoringVersion);
    expect(record.obligationTaxonomyVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(record.consequenceModelVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('record is JSON-serializable (persistable, no functions/cycles)', () => {
    const { trace } = scoreAssessment('json', buildUniformAnswers(0));
    const findings = deriveFindings(trace, EVIDENCE);
    const record = buildTraceabilityRecord('json', trace, findings);
    expect(() => JSON.parse(JSON.stringify(record))).not.toThrow();
  });
});
