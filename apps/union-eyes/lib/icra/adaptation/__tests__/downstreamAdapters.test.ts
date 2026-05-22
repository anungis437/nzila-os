/**
 * OCRA downstream adapter tests (Products 2/3/4/5).
 *
 * Invariants asserted:
 *  - Determinism per call (same input ⇒ identical payload).
 *  - All payloads are frozen.
 *  - PII boundary: no UUIDs, no emails, no free text.
 *  - Small-scale runtime invariants are suppressed.
 *  - Stabilization priorities respect mission-critical exposure.
 *  - Intelligence signal does not leak raw composite.
 */

import { describe, expect, it } from 'vitest';

import {
  adaptScoring,
  classifyOrgContext,
  type ContextualAssessmentResult,
} from '@/lib/icra/adaptation';
import { buildIntelligenceSignal } from '@/lib/intelligence/adapters/ocraIntelligenceSignalAdapter';
import { buildRuntimeSignal } from '@/lib/runtime/adapters/ocraRuntimeSignalAdapter';
import { buildStabilizationPayload } from '@/lib/runtime/adapters/ocraToStabilizationAdapter';
import { buildWorkbookAdaptiveHandoff } from '@/lib/workbook/adapters/ocraAdaptiveHandoff';
import type {
  ContinuityObservation,
  InstitutionalContinuityProfile,
  MaturityBand,
} from '@/lib/icra/types';

const STUB_BAND: MaturityBand = {
  id: 'structured_governance',
  ordinal: 3,
  name: 'Structured Governance',
  ociBandName: 'Structured Continuity',
  operationalPattern: 'Process-driven',
  summary: 'stub',
  operationalCharacteristics: [],
  governanceImplications: [],
  continuityImplications: [],
  minComposite: 50,
};

function buildRaw(
  overrides: Partial<InstitutionalContinuityProfile> = {},
): InstitutionalContinuityProfile {
  return {
    assessmentId: 'stub',
    generatedAt: '2026-05-22T00:00:00.000Z',
    maturityBand: STUB_BAND,
    composite: 60,
    dimensions: [],
    sections: [],
    observations: [],
    recommendations: [],
    answeredQuestionCount: 32,
    questionBankVersion: 3,
    ...overrides,
  };
}

const PROFILE_MICRO = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'local_union',
    ctx_sector: 'labour_union',
    ctx_membership_size: 'under_100',
    ctx_years_operating: '5_to_14_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

const PROFILE_HEALTH = classifyOrgContext({
  rawForm: {
    ctx_org_type: 'health_authority',
    ctx_sector: 'healthcare',
    ctx_membership_size: '10000_49999',
    ctx_years_operating: '30_plus_years',
    ctx_respondent_role: 'self_senior_leader',
  },
});

function pii(s: string): boolean {
  return /@|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s);
}

function flatten(obj: unknown): string {
  return JSON.stringify(obj);
}

function microResult(): ContextualAssessmentResult {
  return adaptScoring(buildRaw(), PROFILE_MICRO);
}

function healthResult(): ContextualAssessmentResult {
  return adaptScoring(buildRaw(), PROFILE_HEALTH);
}

describe('Workbook adaptive handoff (Product 2)', () => {
  it('is deterministic and frozen', () => {
    const r = healthResult();
    const a = buildWorkbookAdaptiveHandoff(r);
    const b = buildWorkbookAdaptiveHandoff(r);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('emits scale + exposure tokens but no PII', () => {
    const p = buildWorkbookAdaptiveHandoff(healthResult());
    expect(p.profileBand.institutionalScale).toBeTruthy();
    expect(p.profileBand.continuityExposure).toBeTruthy();
    expect(pii(flatten(p))).toBe(false);
  });

  it('suggests at least one workbook section when emphasis is non-trivial', () => {
    const p = buildWorkbookAdaptiveHandoff(healthResult());
    expect(p.suggestedWorkbookSections.length).toBeGreaterThan(0);
  });
});

describe('Stabilization payload (Product 3)', () => {
  const material: ContinuityObservation = {
    id: 'succession_plan_absent',
    severity: 'material',
    category: 'governance',
    statement: 'No documented succession plan.',
  };
  const attention: ContinuityObservation = {
    id: 'memory_capture_gap',
    severity: 'attention',
    category: 'memory',
    statement: 'Documentation freshness gap.',
  };

  it('priorities material+mission_critical observations as immediate', () => {
    const r = adaptScoring(buildRaw({ observations: [material] }), PROFILE_HEALTH);
    const p = buildStabilizationPayload(r);
    const a = p.actionables.find((x) => x.observationId === 'succession_plan_absent');
    expect(a?.priority).toBe('immediate');
  });

  it('priorities material+default exposure as planned', () => {
    const r = adaptScoring(buildRaw({ observations: [material] }), PROFILE_MICRO);
    const p = buildStabilizationPayload(r);
    const a = p.actionables.find((x) => x.observationId === 'succession_plan_absent');
    expect(a?.priority).toBe('planned');
  });

  it('priorities attention+mission_critical as planned', () => {
    const r = adaptScoring(buildRaw({ observations: [attention] }), PROFILE_HEALTH);
    const p = buildStabilizationPayload(r);
    const a = p.actionables.find((x) => x.observationId === 'memory_capture_gap');
    expect(a?.priority).toBe('planned');
  });

  it('emits stewardship posture hint deterministically', () => {
    const r = healthResult();
    const p = buildStabilizationPayload(r);
    expect(['rebuild_foundations', 'stabilize_practice', 'reinforce_resilience', 'maintain_excellence']).toContain(
      p.stewardshipPostureHint,
    );
  });

  it('payload is frozen and PII-free', () => {
    const p = buildStabilizationPayload(healthResult());
    expect(Object.isFrozen(p)).toBe(true);
    expect(pii(flatten(p))).toBe(false);
  });
});

describe('Runtime signal (Product 4)', () => {
  it('suppresses cross-unit + runbook invariants at micro scale', () => {
    const sig = buildRuntimeSignal(microResult(), '2026-05-22T00:00:00.000Z');
    expect(sig.watchInvariants).not.toContain('governance.cross_unit_alignment');
    expect(sig.watchInvariants).not.toContain('memory.runbook_coverage');
    // and explicitly enumerated as suppressed if they were candidates
    // (depends on emphasis emitted by adaptScoring for micro)
    for (const s of sig.suppressedInvariants) {
      expect(['governance.cross_unit_alignment', 'memory.runbook_coverage']).toContain(s);
    }
  });

  it('does not suppress at health-authority scale', () => {
    const sig = buildRuntimeSignal(healthResult(), '2026-05-22T00:00:00.000Z');
    expect(sig.suppressedInvariants.length).toBe(0);
  });

  it('is deterministic for fixed emittedAtIso and frozen', () => {
    const t = '2026-05-22T00:00:00.000Z';
    const a = buildRuntimeSignal(healthResult(), t);
    const b = buildRuntimeSignal(healthResult(), t);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('emits no PII', () => {
    const sig = buildRuntimeSignal(healthResult(), '2026-05-22T00:00:00.000Z');
    expect(pii(flatten(sig))).toBe(false);
  });
});

describe('Intelligence signal (Product 5)', () => {
  it('is deterministic and frozen', () => {
    const r = healthResult();
    const a = buildIntelligenceSignal(r, false);
    const b = buildIntelligenceSignal(r, false);
    expect(a).toEqual(b);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('does not leak the raw composite (only severity bucket)', () => {
    const r = adaptScoring(buildRaw({ composite: 73 }), PROFILE_HEALTH);
    const sig = buildIntelligenceSignal(r, false);
    expect(flatten(sig)).not.toContain('73');
    expect(sig.severityBucket).toBeTruthy();
  });

  it('caps topDimensions to 3', () => {
    const r = healthResult();
    const sig = buildIntelligenceSignal(r, false);
    expect(sig.topDimensions.length).toBeLessThanOrEqual(3);
  });

  it('fired rule ids are sorted (aggregation stability)', () => {
    const r = healthResult();
    const sig = buildIntelligenceSignal(r, false);
    const sorted = [...sig.firedRuleIds].sort();
    expect(sig.firedRuleIds).toEqual(sorted);
  });

  it('emits no PII', () => {
    const sig = buildIntelligenceSignal(healthResult(), true);
    expect(pii(flatten(sig))).toBe(false);
  });
});
