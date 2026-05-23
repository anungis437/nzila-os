/**
 * v2 Foundation — Contradiction Coverage
 *
 * Validates the contradiction registry: every defined pair has both
 * signals registered in the v2 question pool, severity totalness, and
 * domain spread across onboarding / governance / stewardship.
 */
import { describe, it, expect } from 'vitest';
import { V2_QUESTIONS } from '../../../modalities-v2/registry';
import { CONTRADICTION_PAIRS } from '../../../contradictions/contradictionSignalPairs';
import {
  composeContradictionPenalties,
  confidencePenaltyForSeverity,
} from '../../../contradictions/contradictionSeverityModel';
import { detectContradictions } from '../../../contradictions/contradictionDetectionEngine';

describe('v2 Foundation — contradiction coverage', () => {
  it('registers at least one contradiction pair per audit-priority domain', () => {
    const pairIds = CONTRADICTION_PAIRS.map((p) => p.pairId);
    expect(pairIds).toContain('pair_onboarding_durability');
    expect(pairIds).toContain('pair_governance_interpretation');
    expect(pairIds).toContain('pair_stewardship_recoverability');
  });

  it('every contradiction pair references a v2 contradiction_pair question id', () => {
    const v2Ids = new Set(V2_QUESTIONS.map((q) => q.id));
    for (const pair of CONTRADICTION_PAIRS) {
      expect(v2Ids.has(pair.signalAQuestionId)).toBe(true);
      expect(v2Ids.has(pair.signalBQuestionId)).toBe(true);
    }
  });

  it('severity model is total over all four severity tiers', () => {
    for (const sev of ['low', 'medium', 'high', 'critical'] as const) {
      const penalty = confidencePenaltyForSeverity(sev);
      expect(penalty).toBeGreaterThan(0);
      expect(penalty).toBeLessThanOrEqual(0.5);
    }
  });

  it('composed penalties never exceed the 0.7 confidence floor cap', () => {
    const allCritical = Array(20).fill('critical' as const);
    const total = composeContradictionPenalties(allCritical);
    expect(total).toBeLessThanOrEqual(0.7);
  });

  it('detection engine reduces confidence and never silently averages', () => {
    const report = detectContradictions([
      {
        pairId: 'pair_governance_interpretation',
        signalAAffirmed: true,
        signalBAffirmed: true,
      },
    ]);
    expect(report.outcomes[0].contradictionDetected).toBe(true);
    expect(report.aggregateConfidencePenalty).toBeGreaterThan(0);
    expect(report.perDimensionConfidencePenalty.institutional_continuity).toBeGreaterThan(0);
  });

  it('detection emits resolution surface for every fired pair', () => {
    const report = detectContradictions([
      {
        pairId: 'pair_stewardship_recoverability',
        signalAAffirmed: true,
        signalBAffirmed: true,
      },
    ]);
    expect(report.outcomes[0].resolutionRequired).not.toBeNull();
  });

  it('non-affirmed pairs do not produce a contradiction outcome', () => {
    const report = detectContradictions([
      {
        pairId: 'pair_onboarding_durability',
        signalAAffirmed: true,
        signalBAffirmed: false,
      },
    ]);
    expect(report.outcomes[0].contradictionDetected).toBe(false);
    expect(report.aggregateConfidencePenalty).toBe(0);
  });
});
