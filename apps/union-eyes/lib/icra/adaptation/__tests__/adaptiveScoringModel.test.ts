/**
 * Adaptive scoring tests.
 *
 * DOCTRINE invariants:
 *  - rawProfile is passed through verbatim (composite never adjusted).
 *  - Same inputs → same outputs.
 *  - Mission-critical exposure raises severity for a given composite.
 *  - Small-org observations referencing enterprise-only infrastructure are filtered.
 */

import { describe, expect, it } from 'vitest';

import { adaptScoring } from '../adaptiveScoringModel';
import { normalizeContextualScore } from '../contextualScoreNormalizer';
import { resolveDomainEmphasis } from '../domainWeightingModel';
import { classifyOrgContext } from '../orgContextClassifier';
import type {
  ContinuityObservation,
  InstitutionalContinuityProfile,
  MaturityBand,
} from '../../types';

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

function buildRawProfile(
  overrides: Partial<InstitutionalContinuityProfile> = {},
): InstitutionalContinuityProfile {
  return {
    assessmentId: 'stub-assessment',
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

describe('adaptScoring — raw composite preserved', () => {
  it('never mutates the raw composite', () => {
    const raw = buildRawProfile({ composite: 73 });
    const r = adaptScoring(raw, PROFILE_HEALTH);
    expect(r.rawProfile.composite).toBe(73);
    expect(r.normalizedInterpretation.rawComposite).toBe(73);
  });

  it('keeps the same raw object reference (no copy mutation)', () => {
    const raw = buildRawProfile({ composite: 60 });
    const r = adaptScoring(raw, PROFILE_HEALTH);
    expect(r.rawProfile).toBe(raw);
  });
});

describe('adaptScoring — determinism', () => {
  it('produces identical results for identical inputs', () => {
    const raw = buildRawProfile({ composite: 70 });
    const a = adaptScoring(raw, PROFILE_HEALTH);
    const b = adaptScoring(raw, PROFILE_HEALTH);
    expect(a).toEqual(b);
  });

  it('returns a frozen result', () => {
    const r = adaptScoring(buildRawProfile(), PROFILE_HEALTH);
    expect(Object.isFrozen(r)).toBe(true);
  });
});

describe('contextualScoreNormalizer — exposure-aware bands', () => {
  it('reads 70 as workable under default exposure', () => {
    const r = normalizeContextualScore(70, PROFILE_MICRO);
    expect(r.severity).toBe('workable');
  });

  it('reads the same 70 as concerning under mission_critical exposure', () => {
    const r = normalizeContextualScore(70, PROFILE_HEALTH);
    expect(r.severity).toBe('concerning');
  });

  it('clamps composite to [0,100]', () => {
    expect(normalizeContextualScore(150, PROFILE_HEALTH).rawComposite).toBe(100);
    expect(normalizeContextualScore(-20, PROFILE_HEALTH).rawComposite).toBe(0);
  });
});

describe('resolveDomainEmphasis — profile-driven weighting', () => {
  it('emphasizes trust_debt for small orgs', () => {
    const e = resolveDomainEmphasis(PROFILE_MICRO);
    const trust = e.find((d) => d.dimension === 'trust_debt');
    expect((trust?.weight ?? 0)).toBeGreaterThan(0.5);
  });

  it('emphasizes institutional_continuity for mission-critical orgs', () => {
    const e = resolveDomainEmphasis(PROFILE_HEALTH);
    const cont = e.find((d) => d.dimension === 'institutional_continuity');
    expect((cont?.weight ?? 0)).toBeGreaterThan(0.5);
  });
});

describe('adaptScoring — scale-adjusted warnings', () => {
  const enterpriseOnlyObs: ContinuityObservation = {
    id: 'multi_region_runtime_governance',
    severity: 'attention',
    category: 'governance',
    statement: 'Multi-site runtime governance is not yet established.',
  };
  const universalObs: ContinuityObservation = {
    id: 'succession_plan_absent',
    severity: 'material',
    category: 'governance',
    statement: 'No documented succession plan was identified.',
  };

  it('filters enterprise-only warnings for micro orgs', () => {
    const raw = buildRawProfile({
      observations: [enterpriseOnlyObs, universalObs],
    });
    const r = adaptScoring(raw, PROFILE_MICRO);
    expect(r.scaleAdjustedWarnings.length).toBe(1);
    expect(r.scaleAdjustedWarnings[0].id).toBe('succession_plan_absent');
    expect(
      r.adaptationRationale.some((x) => x.area === 'warning_filter'),
    ).toBe(true);
  });

  it('keeps the same warning for a health authority', () => {
    const raw = buildRawProfile({
      observations: [enterpriseOnlyObs, universalObs],
    });
    const r = adaptScoring(raw, PROFILE_HEALTH);
    expect(r.scaleAdjustedWarnings.length).toBe(2);
    expect(
      r.adaptationRationale.some((x) => x.area === 'warning_filter'),
    ).toBe(false);
  });
});
