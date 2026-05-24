/**
 * v1.2.1 — Foundation Integration Tests.
 *
 * Covers the four P1 integration deliverables:
 *   1. Contradiction → confidence propagation
 *   2. Evidence ladder → scoring bridge (pure helper, deferred wiring)
 *   3. Routing-v2 path predicates + band-deepening proposals
 *   4. Narrative engine contradiction-aware insight slot
 */
import { describe, expect, it } from 'vitest';

import {
  V2_DIMENSION_TO_V1_DOMAIN,
  applyContradictionPenaltiesToConfidence,
} from '../../../contradictions/confidencePenaltyBridge';
import { buildContradictionInsight } from '../../../contradictions/contradictionInsightAdapter';
import type {
  ContradictionOutcome,
  ContradictionReport,
} from '../../../contradictions/contradictionDetectionEngine';
import {
  applyEvidenceMultiplier,
  evidenceMultiplier,
} from '../../../evidence-strength/evidenceScoringBridge';
import { EVIDENCE_LEVEL_ORDER } from '../../../evidence-strength/evidenceTaxonomy';
import {
  ROUTING_PATH_PREDICATES,
  evaluateRoutingPathActivations,
  proposeBandDeepening,
  type PathActivationContext,
} from '../../../routing-v2/pathActivation';
import { ROUTING_PATHS } from '../../../routing-v2/pathTypes';
import { generateInsights } from '../../../insight-engine';
import type { DimensionScore, SectionScore } from '../../../types';

// ─── Task 1 — Contradiction → confidence ─────────────────────────────────

describe('applyContradictionPenaltiesToConfidence', () => {
  const baseline = {
    operational_clarity: 0.8,
    governance_confidence: 0.7,
    reconstruction_confidence: 0.6,
    onboarding_confidence: 0.5,
    modernization_continuity_confidence: null,
    recoverability_confidence: 0.9,
  } as const;

  it('returns identity when there are no penalties', () => {
    const out = applyContradictionPenaltiesToConfidence(baseline, {});
    expect(out).toEqual(baseline);
  });

  it('preserves null domains (refusal-preserving)', () => {
    const out = applyContradictionPenaltiesToConfidence(baseline, {
      institutional_continuity: 0.3,
    });
    expect(out.modernization_continuity_confidence).toBeNull();
  });

  it('subtracts the v2 penalty from the mapped v1 domain', () => {
    const out = applyContradictionPenaltiesToConfidence(baseline, {
      governance_fragility: 0.2,
    });
    expect(out.governance_confidence).toBeCloseTo(0.5, 5);
    // Unmapped domains untouched.
    expect(out.operational_clarity).toBe(0.8);
  });

  it('distributes a penalty to all mapped v1 domains (operational_memory → 2 targets)', () => {
    const out = applyContradictionPenaltiesToConfidence(baseline, {
      operational_memory: 0.1,
    });
    expect(out.reconstruction_confidence).toBeCloseTo(0.5, 5);
    expect(out.recoverability_confidence).toBeCloseTo(0.8, 5);
  });

  it('clamps the cumulative per-domain penalty at 0.7', () => {
    // trust_debt + institutional_continuity both target operational_clarity.
    const out = applyContradictionPenaltiesToConfidence(baseline, {
      trust_debt: 0.5,
      institutional_continuity: 0.5,
    });
    // 0.8 - 0.7 (clamp) = 0.1
    expect(out.operational_clarity).toBeCloseTo(0.1, 5);
  });

  it('floors final confidence at 0', () => {
    const out = applyContradictionPenaltiesToConfidence(
      { ...baseline, onboarding_confidence: 0.1 },
      { transition_readiness: 0.5 },
    );
    expect(out.onboarding_confidence).toBe(0);
  });

  it('ignores unknown v2 dimension keys', () => {
    const out = applyContradictionPenaltiesToConfidence(baseline, {
      not_a_real_dimension: 0.4,
    });
    expect(out).toEqual(baseline);
  });

  it('V2 mapping covers every contradiction dimension', () => {
    const expected = [
      'institutional_continuity',
      'governance_fragility',
      'trust_debt',
      'operational_memory',
      'transition_readiness',
    ];
    expect(Object.keys(V2_DIMENSION_TO_V1_DOMAIN).sort()).toEqual(expected.sort());
  });
});

// ─── Task 2 — Evidence ladder → scoring bridge ───────────────────────────

describe('applyEvidenceMultiplier (pure helper, deferred wiring)', () => {
  it('is identity passthrough when level is undefined', () => {
    expect(applyEvidenceMultiplier(42, undefined)).toBe(42);
    expect(applyEvidenceMultiplier(-3.5, undefined)).toBe(-3.5);
  });

  it('returns 0.5 * contribution at the NONE floor', () => {
    expect(applyEvidenceMultiplier(10, 'NONE')).toBeCloseTo(5, 5);
  });

  it('returns the full contribution at CROSS_VALIDATED', () => {
    expect(applyEvidenceMultiplier(10, 'CROSS_VALIDATED')).toBeCloseTo(10, 5);
  });

  it('is strictly monotone across the evidence ladder', () => {
    let prev = -Infinity;
    for (const level of EVIDENCE_LEVEL_ORDER) {
      const m = evidenceMultiplier(level);
      expect(m).toBeGreaterThan(prev);
      prev = m;
    }
  });

  it('keeps multipliers in [0.5, 1]', () => {
    for (const level of EVIDENCE_LEVEL_ORDER) {
      const m = evidenceMultiplier(level);
      expect(m).toBeGreaterThanOrEqual(0.5);
      expect(m).toBeLessThanOrEqual(1);
    }
  });
});

// ─── Task 3 — Routing-v2 path activation ─────────────────────────────────

describe('routing-v2 path activation', () => {
  const empty: PathActivationContext = {};

  it('activates no paths on an empty context (conservative default)', () => {
    expect(evaluateRoutingPathActivations(empty)).toEqual([]);
  });

  it('exposes a predicate for every defined path', () => {
    for (const path of ROUTING_PATHS) {
      expect(typeof ROUTING_PATH_PREDICATES[path.id]).toBe('function');
    }
  });

  it('activates governance_fragility_path when maturity high AND consistency low', () => {
    const active = evaluateRoutingPathActivations({
      declaredGovernanceMaturity: 4,
      interpretiveConsistencySignal: 0.3,
    });
    expect(active).toContain('governance_fragility_path');
  });

  it('does not activate governance_fragility_path when maturity below threshold', () => {
    const active = evaluateRoutingPathActivations({
      declaredGovernanceMaturity: 2,
      interpretiveConsistencySignal: 0.1,
      governanceEvidenceOrdinal: 0,
    });
    expect(active).not.toContain('governance_fragility_path');
  });

  it('activates contradiction_resolution_path at confidence >= 0.5', () => {
    expect(
      evaluateRoutingPathActivations({ maxContradictionConfidence: 0.5 }),
    ).toContain('contradiction_resolution_path');
    expect(
      evaluateRoutingPathActivations({ maxContradictionConfidence: 0.49 }),
    ).not.toContain('contradiction_resolution_path');
  });

  it('activates federated_governance_path on hybrid governance', () => {
    expect(
      evaluateRoutingPathActivations({ governanceModel: 'hybrid' }),
    ).toContain('federated_governance_path');
  });

  it('activates onboarding_survivability_path on executive_leadership exposure', () => {
    const active = evaluateRoutingPathActivations({
      transitionExposureTags: ['executive_leadership'],
    });
    expect(active).toContain('onboarding_survivability_path');
  });

  describe('proposeBandDeepening', () => {
    it('returns null when the question has no pathDeepens hint', () => {
      expect(proposeBandDeepening('q1', undefined, ['governance_fragility_path'])).toBeNull();
    });

    it('returns null when no activated paths overlap', () => {
      expect(
        proposeBandDeepening(
          'q1',
          ['contradiction_resolution_path'],
          ['governance_fragility_path'],
        ),
      ).toBeNull();
    });

    it('returns a proposal when overlap exists and tags raisesConfidenceFloor', () => {
      const proposal = proposeBandDeepening(
        'q1',
        ['governance_fragility_path', 'federated_governance_path'],
        ['governance_fragility_path'],
      );
      expect(proposal).not.toBeNull();
      expect(proposal!.questionId).toBe('q1');
      expect(proposal!.triggeringPaths).toEqual(['governance_fragility_path']);
      // governance_fragility_path has raisesConfidenceFloor: true
      expect(proposal!.raisesConfidenceFloor).toBe(true);
    });
  });
});

// ─── Task 4 — Narrative engine contradiction-aware ───────────────────────

describe('contradiction-aware narrative adapter', () => {
  function outcome(
    pairId: string,
    detected: boolean,
    severity: ContradictionOutcome['contradictionSeverity'],
    reduces: ReadonlyArray<string> = ['institutional_continuity'],
  ): ContradictionOutcome {
    return {
      pairId,
      name: pairId,
      description: 'test pair',
      contradictionDetected: detected,
      contradictionSeverity: severity,
      contradictionConfidence: detected ? 0.8 : 0,
      resolutionRequired: detected ? 'facilitation' : null,
      reducesConfidenceIn: reduces,
    };
  }

  it('buildContradictionInsight returns null when no contradictions fired', () => {
    const report: ContradictionReport = {
      outcomes: [outcome('p1', false, null)],
      aggregateConfidencePenalty: 0,
      perDimensionConfidencePenalty: {},
    };
    expect(buildContradictionInsight(report)).toBeNull();
  });

  it('maps critical severity → material insight severity', () => {
    const report: ContradictionReport = {
      outcomes: [outcome('p1', true, 'critical')],
      aggregateConfidencePenalty: 0.4,
      perDimensionConfidencePenalty: { institutional_continuity: 0.4 },
    };
    const insight = buildContradictionInsight(report);
    expect(insight).not.toBeNull();
    expect(insight!.severity).toBe('material');
    expect(insight!.category).toBe('contradiction_detected');
  });

  it('maps low severity → observed insight severity', () => {
    const report: ContradictionReport = {
      outcomes: [outcome('p1', true, 'low')],
      aggregateConfidencePenalty: 0.05,
      perDimensionConfidencePenalty: {},
    };
    expect(buildContradictionInsight(report)!.severity).toBe('observed');
  });

  it('headlines pluralise with count', () => {
    const report: ContradictionReport = {
      outcomes: [outcome('p1', true, 'high'), outcome('p2', true, 'medium')],
      aggregateConfidencePenalty: 0.5,
      perDimensionConfidencePenalty: {},
    };
    const insight = buildContradictionInsight(report)!;
    expect(insight.headline).toContain('2');
  });

  it('generateInsights includes the contradiction insight when a report is supplied', () => {
    const dimensionScores: DimensionScore[] = [
      {
        dimension: 'institutional_continuity',
        score: 50,
        contributingQuestions: 1,
        weightTotal: 1,
      },
      {
        dimension: 'governance_fragility',
        score: 60,
        contributingQuestions: 1,
        weightTotal: 1,
      },
      { dimension: 'trust_debt', score: 70, contributingQuestions: 1, weightTotal: 1 },
      {
        dimension: 'operational_memory',
        score: 55,
        contributingQuestions: 1,
        weightTotal: 1,
      },
      {
        dimension: 'transition_readiness',
        score: 50,
        contributingQuestions: 1,
        weightTotal: 1,
      },
    ];
    const sectionScores: SectionScore[] = [];
    const report: ContradictionReport = {
      outcomes: [outcome('pair_onboarding_durability', true, 'critical')],
      aggregateConfidencePenalty: 0.5,
      perDimensionConfidencePenalty: { institutional_continuity: 0.5 },
    };
    const out = generateInsights(dimensionScores, sectionScores, undefined, undefined, report);
    const contradictionInsight = out.insights.find(
      (i) => i.category === 'contradiction_detected',
    );
    expect(contradictionInsight).toBeDefined();
    expect(contradictionInsight!.severity).toBe('material');
  });

  it('generateInsights omits the contradiction insight when no report is supplied', () => {
    const out = generateInsights([], []);
    expect(out.insights.some((i) => i.category === 'contradiction_detected')).toBe(false);
  });
});
